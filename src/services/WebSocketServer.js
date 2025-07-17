const WebSocket = require('ws');
const EventEmitter = require('events');
const CONFIG = require('../config');

/**
 * WebSocketServer class for real-time client communication
 * Manages connections and broadcasts traffic data to connected clients
 */
class WebSocketServer extends EventEmitter {
  constructor(port = CONFIG.WEBSOCKET_PORT) {
    super();
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.isRunning = false;
    this.messageQueue = [];
    this.maxQueueSize = 1000;
  }

  /**
   * Starts the WebSocket server
   */
  start() {
    if (this.isRunning) {
      console.log('[WebSocketServer] Already running');
      return;
    }

    try {
      console.log(`[WebSocketServer] Starting WebSocket server on port ${this.port}...`);
      
      this.server = new WebSocket.Server({ 
        port: this.port,
        host: 'localhost' // Bind to localhost only for security
      });

      this.server.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });

      this.server.on('error', (error) => {
        console.error('[WebSocketServer] Server error:', error.message);
        this.emit('error', error);
      });

      this.server.on('listening', () => {
        console.log(`[WebSocketServer] WebSocket server listening on ws://localhost:${this.port}`);
        this.isRunning = true;
        this.emit('started');
      });

    } catch (error) {
      console.error('[WebSocketServer] Failed to start server:', error.message);
      this.emit('error', error);
    }
  }

  /**
   * Handles new WebSocket connections
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} request - HTTP request object
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'] || 'Unknown',
      connectedAt: new Date().toISOString()
    };

    console.log(`[WebSocketServer] Client connected: ${clientId} from ${clientInfo.ip}`);
    
    // Add to clients set
    this.clients.add(ws);
    ws.clientInfo = clientInfo;

    // Send welcome message
    this.sendToClient(ws, {
      type: 'welcome',
      clientId: clientId,
      serverTime: Date.now(),
      message: 'Connected to Live Traffic Globe'
    });

    // Send any queued messages to new client
    this.sendQueuedMessages(ws);

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      console.log(`[WebSocketServer] Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);
      this.clients.delete(ws);
      this.emit('clientDisconnected', clientInfo);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error(`[WebSocketServer] Client error (${clientId}):`, error.message);
      this.clients.delete(ws);
    });

    // Emit connection event
    this.emit('clientConnected', clientInfo);
  }

  /**
   * Handles incoming messages from clients
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} data - Message data
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocketServer] Received message from ${ws.clientInfo.id}:`, message.type);

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;
        
        case 'status':
          this.sendToClient(ws, {
            type: 'status',
            server: this.getStatus(),
            timestamp: Date.now()
          });
          break;
        
        default:
          console.log(`[WebSocketServer] Unknown message type: ${message.type}`);
      }

      this.emit('message', { client: ws.clientInfo, message });

    } catch (error) {
      console.error(`[WebSocketServer] Error parsing message from ${ws.clientInfo.id}:`, error.message);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Broadcasts a message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    if (!message || typeof message !== 'object') {
      console.error('[WebSocketServer] Invalid message for broadcast');
      return;
    }

    const messageStr = JSON.stringify({
      ...message,
      timestamp: message.timestamp || Date.now()
    });

    let successCount = 0;
    let failureCount = 0;

    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          successCount++;
        } catch (error) {
          console.error(`[WebSocketServer] Error sending to client ${ws.clientInfo.id}:`, error.message);
          failureCount++;
          this.clients.delete(ws);
        }
      } else {
        // Remove closed connections
        this.clients.delete(ws);
        failureCount++;
      }
    });

    if (successCount > 0) {
      console.log(`[WebSocketServer] Broadcasted message to ${successCount} clients (${failureCount} failed)`);
    }

    // Queue message if no clients are connected
    if (this.clients.size === 0) {
      this.queueMessage(message);
    }
  }

  /**
   * Sends a message to a specific client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now()
        });
        ws.send(messageStr);
      } catch (error) {
        console.error(`[WebSocketServer] Error sending to client ${ws.clientInfo.id}:`, error.message);
        this.clients.delete(ws);
      }
    }
  }

  /**
   * Queues a message for when clients connect
   * @param {Object} message - Message to queue
   */
  queueMessage(message) {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    
    this.messageQueue.push({
      ...message,
      queuedAt: Date.now()
    });
  }

  /**
   * Sends queued messages to a newly connected client
   * @param {WebSocket} ws - WebSocket connection
   */
  sendQueuedMessages(ws) {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`[WebSocketServer] Sending ${this.messageQueue.length} queued messages to ${ws.clientInfo.id}`);
    
    this.messageQueue.forEach(message => {
      this.sendToClient(ws, message);
    });
  }

  /**
   * Clears the message queue
   */
  clearQueue() {
    this.messageQueue = [];
    console.log('[WebSocketServer] Message queue cleared');
  }

  /**
   * Stops the WebSocket server
   */
  stop() {
    if (!this.isRunning) {
      console.log('[WebSocketServer] Not running');
      return;
    }

    console.log('[WebSocketServer] Stopping WebSocket server...');

    // Close all client connections
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutting down');
      }
    });
    this.clients.clear();

    // Close server
    if (this.server) {
      this.server.close(() => {
        console.log('[WebSocketServer] Server stopped');
        this.isRunning = false;
        this.emit('stopped');
      });
    }
  }

  /**
   * Generates a unique client ID
   * @returns {string} - Unique client identifier
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets server status and statistics
   * @returns {Object} - Server status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      clientCount: this.clients.size,
      queueSize: this.messageQueue.length,
      maxQueueSize: this.maxQueueSize,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Gets information about connected clients
   * @returns {Array} - Array of client information
   */
  getClients() {
    return Array.from(this.clients).map(ws => ({
      ...ws.clientInfo,
      readyState: ws.readyState,
      readyStateText: this.getReadyStateText(ws.readyState)
    }));
  }

  /**
   * Converts WebSocket ready state to text
   * @param {number} readyState - WebSocket ready state
   * @returns {string} - Ready state as text
   */
  getReadyStateText(readyState) {
    switch (readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Sends a ping to all connected clients
   */
  pingClients() {
    this.broadcast({
      type: 'ping',
      timestamp: Date.now()
    });
  }
}

module.exports = WebSocketServer;