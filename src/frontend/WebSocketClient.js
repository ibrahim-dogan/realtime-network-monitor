/**
 * WebSocketClient class for connecting to backend agent
 * Handles real-time data connection with automatic reconnection
 */
class WebSocketClient {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.pingInterval = 30000; // 30 seconds
    this.lastPongTime = null;
    
    // Event handlers
    this.eventHandlers = {
      open: [],
      close: [],
      error: [],
      message: [],
      traffic: [],
      stats: [],
      reconnecting: [],
      reconnected: []
    };
  }

  /**
   * Connects to the WebSocket server
   */
  connect() {
    if (this.isConnected || this.isConnecting) {
      console.log('[WebSocketClient] Already connected or connecting');
      return;
    }

    console.log(`[WebSocketClient] Connecting to ${this.url}...`);
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = (event) => {
        console.log('[WebSocketClient] Connected successfully');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTime = Date.now();
        
        // Start ping timer
        this.startPingTimer();
        
        // Emit reconnected event if this was a reconnection
        if (this.reconnectAttempts > 0) {
          this.emit('reconnected', event);
        }
        
        this.emit('open', event);
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocketClient] Connection closed (code: ${event.code}, reason: ${event.reason})`);
        this.isConnected = false;
        this.isConnecting = false;
        
        // Stop ping timer
        this.stopPingTimer();
        
        this.emit('close', event);
        
        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WebSocketClient] WebSocket error:', event);
        this.isConnecting = false;
        this.emit('error', event);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

    } catch (error) {
      console.error('[WebSocketClient] Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  /**
   * Handles incoming WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type) {
        case 'welcome':
          console.log(`[WebSocketClient] Welcome message: ${data.message}`);
          break;
          
        case 'traffic':
          this.emit('traffic', data);
          break;
          
        case 'stats':
          this.emit('stats', data.data);
          break;
          
        case 'pong':
          this.lastPongTime = Date.now();
          break;
          
        case 'ping':
          this.send({ type: 'pong', timestamp: Date.now() });
          break;
          
        case 'error':
          console.error('[WebSocketClient] Server error:', data.message);
          break;
          
        default:
          console.log(`[WebSocketClient] Unknown message type: ${data.type}`);
      }
      
      this.emit('message', data);
      
    } catch (error) {
      console.error('[WebSocketClient] Error parsing message:', error);
    }
  }

  /**
   * Sends a message to the server
   * @param {Object} message - Message to send
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      console.warn('[WebSocketClient] Cannot send message: not connected');
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      return true;
    } catch (error) {
      console.error('[WebSocketClient] Error sending message:', error);
      return false;
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: delay
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Starts the ping timer to keep connection alive
   */
  startPingTimer() {
    this.stopPingTimer();
    
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        // Check if we received a pong recently
        const timeSinceLastPong = Date.now() - (this.lastPongTime || 0);
        
        if (timeSinceLastPong > this.pingInterval * 2) {
          console.warn('[WebSocketClient] No pong received, connection may be dead');
          this.disconnect();
          return;
        }
        
        // Send ping
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.pingInterval);
  }

  /**
   * Stops the ping timer
   */
  stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Disconnects from the WebSocket server
   */
  disconnect() {
    console.log('[WebSocketClient] Disconnecting...');
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingTimer();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Requests server status
   */
  requestStatus() {
    this.send({ type: 'status' });
  }

  /**
   * Adds an event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    } else {
      console.warn(`[WebSocketClient] Unknown event: ${event}`);
    }
  }

  /**
   * Removes an event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function to remove
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Emits an event to all registered handlers
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocketClient] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Gets the current connection status
   * @returns {Object} - Connection status information
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      url: this.url,
      readyState: this.ws ? this.ws.readyState : null,
      lastPongTime: this.lastPongTime
    };
  }

  /**
   * Sets reconnection parameters
   * @param {number} maxAttempts - Maximum reconnection attempts
   * @param {number} initialDelay - Initial reconnection delay in ms
   * @param {number} maxDelay - Maximum reconnection delay in ms
   */
  setReconnectionConfig(maxAttempts, initialDelay, maxDelay) {
    this.maxReconnectAttempts = maxAttempts;
    this.reconnectDelay = initialDelay;
    this.maxReconnectDelay = maxDelay;
  }

  /**
   * Sets ping interval
   * @param {number} interval - Ping interval in milliseconds
   */
  setPingInterval(interval) {
    this.pingInterval = interval;
    if (this.isConnected) {
      this.startPingTimer();
    }
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketClient;
} else if (typeof window !== 'undefined') {
  window.WebSocketClient = WebSocketClient;
}