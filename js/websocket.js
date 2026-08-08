/**
 * Smart TV WebSocket Client - Connects TV app to Desktop Manager Backend Server
 */
export class SignageWebSocketClient {
  constructor(options = {}) {
    this.serverIp = options.serverIp || 'localhost';
    this.serverPort = options.serverPort || 3000;
    this.deviceId = options.deviceId || 'tv_' + Math.random().toString(36).substr(2, 6);
    this.deviceName = options.deviceName || 'Smart TV';
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    
    // Callbacks from App Controller
    this.onStatusRequested = options.onStatusRequested;
    this.onPlayItemCommand = options.onPlayItemCommand;
    this.onReorderCommand = options.onReorderCommand;
    this.onAddItemCommand = options.onAddItemCommand;
    this.onUpdateItemCommand = options.onUpdateItemCommand;
    this.onDeleteItemCommand = options.onDeleteItemCommand;
    this.onPlayPauseCommand = options.onPlayPauseCommand;
    this.onPrevItemCommand = options.onPrevItemCommand;
    this.onNextItemCommand = options.onNextItemCommand;
    this.onSetLayoutCommand = options.onSetLayoutCommand;
    this.onSetTickerCommand = options.onSetTickerCommand;
    this.onSetQrCommand = options.onSetQrCommand;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Connect or Reconnect to Desktop Manager Server
   */
  connect(ip = null, port = null, deviceId = null, deviceName = null) {
    if (ip) this.serverIp = ip;
    if (port) this.serverPort = port;
    if (deviceId) this.deviceId = deviceId;
    if (deviceName) this.deviceName = deviceName;

    this.disconnect();

    const wsUrl = `ws://${this.serverIp}:${this.serverPort}`;
    console.log(`[WS-Client] Connecting (${this.deviceName}) to ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[WS-Client] Connected to Desktop Manager Server as ${this.deviceName}`);
        this.isConnected = true;

        // Identify as TV client with Device Profile details
        this.send({
          type: 'identify',
          role: 'tv',
          deviceId: this.deviceId,
          deviceName: this.deviceName
        });

        if (this.onStateChange) this.onStateChange(true, wsUrl);

        // Send initial status
        this.sendStatus();
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        this.handleMessage(msg);
      };

      this.ws.onclose = () => {
        console.log('[WS-Client] Disconnected from server');
        this.isConnected = false;
        if (this.onStateChange) this.onStateChange(false, wsUrl);

        // Auto-reconnect after 5 seconds
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.serverIp) this.connect();
        }, 5000);
      };

      this.ws.onerror = (err) => {
        console.warn('[WS-Client] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[WS-Client] Connection failed:', err);
      this.isConnected = false;
      if (this.onStateChange) this.onStateChange(false, wsUrl);
    }
  }

  /**
   * Disconnect current WebSocket
   */
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Send JSON payload to WebSocket server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send full TV telemetry & status update back to Desktop Manager
   */
  sendStatus(extraState = {}) {
    if (!this.isConnected) return;
    const statusData = this.onStatusRequested ? this.onStatusRequested() : {};
    this.send({
      type: 'tv_status',
      ...statusData,
      ...extraState
    });
  }

  /**
   * Process incoming command messages from Desktop Manager
   */
  async handleMessage(msg) {
    console.log('[WS-Client] Received message:', msg.type, msg);

    switch (msg.type) {
      case 'request_status':
        this.sendStatus();
        break;

      case 'play_item':
        if (this.onPlayItemCommand) await this.onPlayItemCommand(msg.index);
        this.sendStatus();
        break;

      case 'reorder':
        if (this.onReorderCommand) await this.onReorderCommand(msg.fromIndex, msg.toIndex);
        this.sendStatus();
        break;

      case 'add_item':
        if (this.onAddItemCommand) await this.onAddItemCommand(msg.item);
        this.sendStatus();
        break;

      case 'update_item':
        if (this.onUpdateItemCommand) await this.onUpdateItemCommand(msg.item);
        this.sendStatus();
        break;

      case 'delete_item':
        if (this.onDeleteItemCommand) await this.onDeleteItemCommand(msg.id);
        this.sendStatus();
        break;

      case 'play_pause':
        if (this.onPlayPauseCommand) this.onPlayPauseCommand();
        this.sendStatus();
        break;

      case 'prev_item':
        if (this.onPrevItemCommand) this.onPrevItemCommand();
        this.sendStatus();
        break;

      case 'next_item':
        if (this.onNextItemCommand) this.onNextItemCommand();
        this.sendStatus();
        break;

      case 'set_layout':
        if (this.onSetLayoutCommand) this.onSetLayoutCommand(msg.layout);
        this.sendStatus();
        break;

      case 'set_ticker':
        if (this.onSetTickerCommand) this.onSetTickerCommand(msg.text);
        this.sendStatus();
        break;

      case 'set_qr':
        if (this.onSetQrCommand) this.onSetQrCommand(msg.url, msg.label);
        this.sendStatus();
        break;
    }
  }
}
