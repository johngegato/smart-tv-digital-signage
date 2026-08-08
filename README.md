# 🎬 Smart TV Digital Signage & HD Ad Player (LG webOS)

An ultra-modern, high-performance **Digital Signage & Commercial Ad Player Web Application** designed specifically for **LG webOS TVs**, **Devant Smart TVs**, and commercial digital menu boards/kiosks.

Features real-time crossfade transitions, multi-zone layouts (Fullscreen, Split-Screen, Grid, 9:16 Portrait), time-of-day campaign scheduling, High-DPI QR codes, network fault resilience, and real-time remote management over LAN via WebSocket.

---

## 🌟 Key Features

- **📺 Multi-Zone Layout Modes**:
  - 🔴 **Fullscreen 16:9**: Clean edge-to-edge video and image presentation with optional floating clock.
  - 🟢 **Split-Screen Layout**: Main media viewport paired with live clock, weather, and QR promo widgets.
  - 🟡 **Grid Layout Mode**: 2x2 multi-ad showcase menu board layout.
  - 📱 **Portrait Vertical Mode**: 9:16 aspect ratio vertical layout for commercial retail pillars and kiosks.
- **📡 Desktop Manager Remote Control Sync**: Real-time bidirectional WebSocket synchronization between Desktop Admin Manager and Smart TV.
- **⏰ Time-of-Day Schedule Slot Filtering**: Automatically filters active campaign slots by hour (`morning`, `afternoon`, `evening`, `all`).
- **🛡️ Resilience & Fast-Skip Recovery**: Automatic `onerror` detection on videos/images to immediately skip broken media without stalling playback.
- **🎮 Spatial D-Pad Navigation**: Fully optimized for TV remote D-Pad controls (LG Magic Remote, standard remote keys).
- **💾 IndexedDB & LocalStorage**: Store large media files directly on TV local storage for offline operation.

---

## 🚀 Quick Start

### 1. Launch the Desktop Remote Manager Server
```bash
npm start
# Server runs on http://localhost:3000
```

### 2. Connect the Smart TV App
1. Open the **Smart TV App** in your TV browser or deploy via LG webOS CLI (`ares-package .`).
2. Open **Campaign Studio** (Press `Blue Key` or `S`).
3. Under **Desktop Remote Server**, enter your computer's local IP address (e.g. `192.168.1.100`).
4. Click **Connect**. The status pill will turn **● Connected**.

---

## 🎮 TV Remote Control Key Reference

| Key / Button | Action |
|---|---|
| **D-Pad Up / Down / Left / Right** | 4-Way Spatial Element Focus Navigation |
| **OK / Enter / Space** | Select Element / Play & Pause Media |
| **Back Key (KeyCode 461 / Esc)** | Close Studio / Modals / Control Overlay |
| **🔴 Red Button (Key 1)** | Fullscreen Layout |
| **🟢 Green Button (Key 2)** | Split-Screen Layout |
| **🟡 Yellow Button (Key 3)** | Grid Display Layout |
| **📱 Key 4** | Portrait Vertical Display Mode |
| **🔵 Blue Button (Key S)** | Open / Close Campaign Studio Drawer |
| **M / Mute Key** | Mute / Unmute Audio |
| **F Key** | Toggle Fullscreen |

---

## 📦 How to Install & Deploy via LG webOS TV CLI (`ares-*`)

Follow these step-by-step instructions to package and deploy the app natively onto your **LG webOS TV** or **Devant Smart TV (webOS edition)** using the official LG webOS TV CLI tools.

---

### Step 1: Install LG webOS TV CLI Tools
Ensure Node.js is installed on your computer, then install the webOS CLI globally:
```bash
npm install -g @webos-tools/cli
```
*(Or download the official installer from the [LG webOS TV Developer Site](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)).*

Verify installation:
```bash
ares --version
```

---

### Step 2: Enable Developer Mode on your LG / Devant TV
1. On your LG webOS TV, open the **LG Content Store** (or App Store).
2. Search for and install the official **Developer Mode** app.
3. Launch the **Developer Mode app** on your TV and log in with your LG Developer account.
4. Toggle **Dev Mode Status** to **ON**.
5. Toggle **Key Server** to **ON**.
6. Note down the **IP Address** and **Passphrase** displayed on your TV screen.
7. Restart your TV when prompted by the Developer Mode app.

---

### Step 3: Package the App into `.ipk`
Open your terminal in the `smart-tv-digital-signage-webos/` directory and run:
```bash
ares-package .
```
This generates an installer package file:
`com.devant.smarttv.signage_1.0.0_all.ipk`

---

### Step 4: Register & Add TV Device
Add your TV's local IP address to your computer's CLI device list:
```bash
ares-setup-device
```
* Select **add**
* Enter device name: `my-tv` (or `devant-tv`)
* Enter IP address: `<YOUR_TV_IP_ADDRESS>` (e.g. `192.168.1.150`)
* Enter port: `9922` (default)
* Enter SSH user: `developer` (default)

---

### Step 5: Fetch SSH Authentication Key (`ares-novacom`)
Pair your computer with the TV using the 6-character Passphrase shown in your TV Developer Mode app:
```bash
ares-novacom --getkey -d my-tv
```
When prompted, type the **Passphrase** shown on your TV screen.

---

### Step 6: Install the `.ipk` Package onto TV
Install the packaged app onto your connected TV:
```bash
ares-install -d my-tv com.devant.smarttv.signage_1.0.0_all.ipk
```
*(You will see a `[Success]` response once installation completes).*

---

### Step 7: Launch the Application on TV
Launch the app directly on the TV screen:
```bash
ares-launch -d my-tv com.devant.smarttv.signage
```

Useful CLI debugging commands:
```bash
# Check running apps on TV
ares-launch -d my-tv --running

# Close application on TV
ares-launch -d my-tv --close com.devant.smarttv.signage

# View live application console logs
ares-inspect -d my-tv com.devant.smarttv.signage
```

---

## 💾 Alternative: Sideloading via USB Drive

If you don't want to use the CLI, you can sideload the app directly via USB drive:
1. Format a USB flash drive to **FAT32**.
2. Create the folder path: `USB:\developer\apps\usr\palm\applications\com.devant.smarttv.signage\`
3. Copy all files (`index.html`, `appinfo.json`, `css/`, `js/`, `assets/`) into that folder.
4. Plug the USB into your LG / Devant Smart TV.
5. Open the **Developer Mode app** on the TV to launch the USB sideloaded application.

## 🌐 How to Host Signage Manager Online for Worldwide Remote Control

You can host the **Signage Manager** online so you can manage your Smart TVs remotely from anywhere in the world via the internet.

Because the manager requires Node.js, file uploads (`multer`), and real-time WebSockets (`ws`), it requires a Node server runner (like Render.com or Railway) connected to your **GitHub repository**.

---

### Step-by-Step Online Hosting Guide:

#### Step 1: Push Project to GitHub
1. Create a new repository on [GitHub](https://github.com/new) named `smart-tv-digital-signage`.
2. Push your project code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial Smart TV Digital Signage project"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-tv-digital-signage.git
   git push -u origin main
   ```

---

#### Step 2: Deploy Free Node.js + WebSocket Server on Render.com
1. Sign up for a free account at [Render.com](https://render.com/).
2. Click **New +** → **Web Service**.
3. Connect your **GitHub account** and select your `smart-tv-digital-signage` repository.
4. Configure service settings:
   - **Name**: `my-signage-manager`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**.
6. Once deployed, Render provides your live URL:
   `https://my-signage-manager.onrender.com`

---

#### Step 3: Connect Smart TVs Worldwide
1. Open the **Smart TV App** on any LG / Devant TV connected to the internet.
2. Open **Campaign Studio** (Press `Blue Key` or `S`).
3. Under **Desktop Remote Server**, enter your Render URL domain:
   `my-signage-manager.onrender.com`
4. Click **Connect**.
5. Your TV will show **● Connected** and can now be controlled from anywhere via `https://my-signage-manager.onrender.com`!

---

For native LG webOS IPK packaging and USB sideloading instructions, refer to [`WEBOS_DEPLOYMENT_GUIDE.md`](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/WEBOS_DEPLOYMENT_GUIDE.md).


