/**
 * Digital Signage Desktop Manager — Node.js Server
 * Serves the Desktop Admin UI, handles media file uploads,
 * and relays real-time WebSocket commands between Desktop ↔ Smart TV.
 *
 * Usage: node server.js
 * Desktop Manager UI: http://localhost:3000
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Configuration ────────────────────────────────────────────────────────────
const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── Multer File Upload ────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp|bmp)|video\/(mp4|webm|ogg|mov|avi)/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, OGG'));
    }
  }
});

// ─── Helper: Get local network IPs ────────────────────────────────────────────
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ address: net.address, iface: name });
      }
    }
  }
  return ips;
}

// ─── REST API ─────────────────────────────────────────────────────────────────

/** Server info — returns local IPs for TV connection instructions */
app.get('/api/info', (req, res) => {
  const ips = getLocalIPs();
  res.json({
    port: PORT,
    ips,
    primaryIp: ips.length > 0 ? ips[0].address : '127.0.0.1',
    tvStatus: clients.has('tv') ? 'connected' : 'disconnected'
  });
});

/** Upload a media file — returns URL accessible by TV over LAN */
app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const ips = getLocalIPs();
  const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';
  const tvAccessibleUrl = `http://${primaryIp}:${PORT}/uploads/${req.file.filename}`;

  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    url: tvAccessibleUrl,           // For TV to fetch over LAN
    localUrl: `/uploads/${req.file.filename}`, // For desktop preview
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

/** List all uploaded media files */
app.get('/api/uploads', (req, res) => {
  try {
    const ips = getLocalIPs();
    const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';

    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => !f.startsWith('.'))
      .map(filename => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
        const ext = path.extname(filename).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
        return {
          filename,
          url: `http://${primaryIp}:${PORT}/uploads/${filename}`,
          localUrl: `/uploads/${filename}`,
          size: stats.size,
          modified: stats.mtime,
          type: isVideo ? 'video' : 'image'
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete an uploaded file */
app.delete('/api/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // Sanitize
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WebSocket Hub ────────────────────────────────────────────────────────────
// Tracks connected TV devices (Map<deviceId, object>) and Desktop managers (Set<ws>)
const tvDevices = new Map();
const desktopClients = new Set();

function getTvList() {
  const list = [];
  tvDevices.forEach((dev) => {
    list.push({
      deviceId: dev.deviceId,
      deviceName: dev.deviceName,
      ip: dev.ip,
      status: dev.status || {}
    });
  });
  return list;
}

function broadcastToDesktops(message) {
  const jsonStr = JSON.stringify(message);
  desktopClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(jsonStr);
    }
  });
}

function sendToTvDevices(targetDeviceId, message) {
  const jsonStr = JSON.stringify(message);
  if (!targetDeviceId || targetDeviceId === 'all') {
    tvDevices.forEach((dev) => {
      if (dev.ws && dev.ws.readyState === WebSocket.OPEN) {
        dev.ws.send(jsonStr);
      }
    });
  } else {
    const dev = tvDevices.get(targetDeviceId);
    if (dev && dev.ws && dev.ws.readyState === WebSocket.OPEN) {
      dev.ws.send(jsonStr);
    }
  }
}

wss.on('connection', (ws, req) => {
  let clientRole = 'unknown';
  let deviceId = null;
  let deviceName = null;
  const clientIp = req.socket.remoteAddress;

  console.log(`[WS] New connection from ${clientIp}`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // ── Identify client role ──
    if (msg.type === 'identify') {
      clientRole = msg.role; // 'tv' or 'desktop'

      if (clientRole === 'tv') {
        deviceId = msg.deviceId || 'tv_' + Math.random().toString(36).substr(2, 6);
        deviceName = msg.deviceName || 'Smart TV';

        tvDevices.set(deviceId, {
          ws,
          deviceId,
          deviceName,
          ip: clientIp,
          status: {}
        });

        console.log(`[WS] TV identified: "${deviceName}" (ID: ${deviceId})`);

        // Notify desktop managers of TV connection and updated TV list
        broadcastToDesktops({
          type: 'tv_connected',
          deviceId,
          deviceName,
          tvs: getTvList()
        });

        // Request status from this TV
        ws.send(JSON.stringify({ type: 'request_status' }));
      } else if (clientRole === 'desktop') {
        desktopClients.add(ws);
        console.log(`[WS] Desktop Manager connected`);

        // Send current TV list to desktop
        ws.send(JSON.stringify({
          type: 'tv_list',
          tvs: getTvList()
        }));

        // Request fresh status from all TVs
        sendToTvDevices('all', { type: 'request_status' });
      }
      return;
    }

    // ── Message Routing ──
    if (clientRole === 'desktop') {
      const target = msg.targetDeviceId || 'all';
      sendToTvDevices(target, msg);
    } else if (clientRole === 'tv') {
      if (msg.type === 'tv_status' && deviceId && tvDevices.has(deviceId)) {
        tvDevices.get(deviceId).status = msg;
      }
      // Broadcast TV telemetry to desktops with device ID & name
      broadcastToDesktops({
        ...msg,
        deviceId,
        deviceName,
        tvs: getTvList()
      });
    }
  });

  ws.on('close', () => {
    if (clientRole === 'desktop') {
      desktopClients.delete(ws);
      console.log('[WS] Desktop Manager disconnected');
    } else if (clientRole === 'tv' && deviceId) {
      tvDevices.delete(deviceId);
      console.log(`[WS] TV disconnected: "${deviceName}" (${deviceId})`);
      broadcastToDesktops({
        type: 'tv_disconnected',
        deviceId,
        deviceName,
        tvs: getTvList()
      });
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error (${clientRole}):`, err.message);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  const ips = getLocalIPs();
  const divider = '═'.repeat(55);

  console.log(`\n${divider}`);
  console.log('  🎬  Digital Signage Desktop Manager — Server');
  console.log(divider);
  console.log(`  ✅  Server started on port ${PORT}`);
  console.log(`\n  📺  Open Desktop Manager in your browser:`);
  console.log(`      → http://localhost:${PORT}`);
  console.log(`\n  📡  Enter one of these IPs into the TV app settings:`);

  if (ips.length > 0) {
    ips.forEach(({ address, iface }) => {
      console.log(`      → ${address}   (${iface})`);
    });
  } else {
    console.log('      → No network interfaces found. Use 127.0.0.1 for local testing.');
  }

  console.log('\n  💡  On the TV: Studio → Desktop Connect → Enter IP → Connect');
  console.log(`${divider}\n`);
});
