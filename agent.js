#!/usr/bin/env node

/**
 * Live Traffic Globe - Backend Agent
 * Main entry point that coordinates all backend components
 */

const TrafficMonitor = require('./src/services/TrafficMonitor');
const GeolocationService = require('./src/services/GeolocationService');
const WebSocketServer = require('./src/services/WebSocketServer');
const CONFIG = require('./src/config');

class LiveTrafficAgent {
  constructor() {
    this.trafficMonitor = new TrafficMonitor();
    this.geoService = new GeolocationService();
    this.wsServer = new WebSocketServer();
    this.isRunning = false;
    this.stats = {
      startTime: null,
      connectionsProcessed: 0,
      locationsResolved: 0,
      clientsConnected: 0,
      errors: 0
    };
  }

  /**
   * Starts the Live Traffic Globe agent
   */
  async start() {
    if (this.isRunning) {
      console.log('[Agent] Already running');
      return;
    }

    console.log('🌍 Starting Live Traffic Globe Agent...');
    console.log('=====================================');
    
    try {
      this.stats.startTime = Date.now();
      
      // Start WebSocket server first
      await this.startWebSocketServer();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Start traffic monitoring (requires sudo)
      await this.startTrafficMonitoring();
      
      this.isRunning = true;
      console.log('✅ Live Traffic Globe Agent is running!');
      console.log(`📡 WebSocket server: ws://localhost:${CONFIG.WEBSOCKET_PORT}`);
      console.log('🔍 Network monitoring: Active');
      console.log('📍 Geolocation service: Ready');
      console.log('');
      console.log('💡 Open index.html in your browser to view the globe');
      console.log('⚠️  You may be prompted for your password (sudo required for network monitoring)');
      console.log('');

    } catch (error) {
      console.error('❌ Failed to start agent:', error.message);
      await this.stop();
      process.exit(1);
    }
  }

  /**
   * Starts the WebSocket server
   */
  async startWebSocketServer() {
    return new Promise((resolve, reject) => {
      this.wsServer.on('started', () => {
        console.log('✅ WebSocket server started');
        resolve();
      });

      this.wsServer.on('error', (error) => {
        console.error('❌ WebSocket server error:', error.message);
        reject(error);
      });

      this.wsServer.start();
    });
  }

  /**
   * Starts traffic monitoring
   */
  async startTrafficMonitoring() {
    return new Promise((resolve, reject) => {
      this.trafficMonitor.on('started', () => {
        console.log('✅ Network traffic monitoring started');
        resolve();
      });

      this.trafficMonitor.on('error', (error) => {
        console.error('❌ Traffic monitoring error:', error.message);
        
        if (error.message.includes('Permission') || error.message.includes('sudo')) {
          console.log('');
          console.log('🔐 This application requires administrator privileges to monitor network traffic.');
          console.log('💡 Please run: sudo node agent.js');
          console.log('');
        }
        
        reject(error);
      });

      this.trafficMonitor.start();
    });
  }

  /**
   * Sets up event handlers for component communication
   */
  setupEventHandlers() {
    // Handle traffic events from monitor
    this.trafficMonitor.on('traffic', async (trafficData) => {
      await this.handleTrafficEvent(trafficData);
    });

    // Handle WebSocket client connections
    this.wsServer.on('clientConnected', (clientInfo) => {
      this.stats.clientsConnected++;
      console.log(`👤 Client connected: ${clientInfo.id} (${this.wsServer.clients.size} total)`);
      
      // Send current stats to new client
      this.wsServer.sendToClient(this.findClientById(clientInfo.id), {
        type: 'stats',
        data: this.getStats()
      });
    });

    this.wsServer.on('clientDisconnected', (clientInfo) => {
      console.log(`👋 Client disconnected: ${clientInfo.id} (${this.wsServer.clients.size} total)`);
      
      // Stop traffic monitoring if no clients connected
      if (this.wsServer.clients.size === 0) {
        console.log('⏸️  No clients connected, pausing traffic monitoring...');
        this.trafficMonitor.stop();
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      this.stop().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      this.stop().then(() => process.exit(0));
    });
  }

  /**
   * Handles traffic events by geolocating IPs and broadcasting to clients
   * @param {Object} trafficData - Traffic data from monitor
   */
  async handleTrafficEvent(trafficData) {
    try {
      this.stats.connectionsProcessed++;
      
      console.log(`🔍 Processing connection: ${trafficData.processName} -> ${trafficData.destIP}:${trafficData.destPort}`);
      
      // Get geolocation for destination IP
      const locationData = await this.geoService.getLocation(trafficData.destIP);
      
      if (locationData && locationData.status === 'success') {
        this.stats.locationsResolved++;
        
        // Create enhanced message for frontend with process classification
        const message = {
          type: 'traffic',
          ip: trafficData.destIP,
          lat: locationData.lat,
          lon: locationData.lon,
          city: locationData.city,
          country: locationData.country,
          processName: trafficData.processName,
          processType: trafficData.processType,
          primaryColor: trafficData.primaryColor,
          gradientColors: trafficData.gradientColors,
          colorScheme: trafficData.colorScheme,
          port: trafficData.destPort,
          timestamp: trafficData.timestamp
        };

        // Broadcast to all connected clients
        this.wsServer.broadcast(message);
        
        console.log(`📍 Located: ${trafficData.destIP} -> ${locationData.city}, ${locationData.country}`);
      } else {
        console.log(`❓ Could not locate: ${trafficData.destIP}`);
      }

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Error handling traffic event:', error.message);
    }
  }

  /**
   * Finds a WebSocket client by ID
   * @param {string} clientId - Client ID to find
   * @returns {WebSocket|null} - WebSocket connection or null
   */
  findClientById(clientId) {
    for (const client of this.wsServer.clients) {
      if (client.clientInfo && client.clientInfo.id === clientId) {
        return client;
      }
    }
    return null;
  }

  /**
   * Gets current agent statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    
    return {
      uptime,
      connectionsProcessed: this.stats.connectionsProcessed,
      locationsResolved: this.stats.locationsResolved,
      clientsConnected: this.wsServer.clients.size,
      totalClientsConnected: this.stats.clientsConnected,
      errors: this.stats.errors,
      trafficMonitor: this.trafficMonitor.getStatus(),
      geoService: this.geoService.getStatus(),
      wsServer: this.wsServer.getStatus()
    };
  }

  /**
   * Prints current statistics
   */
  printStats() {
    const stats = this.getStats();
    const uptimeMinutes = Math.floor(stats.uptime / 60000);
    
    console.log('\n📊 Agent Statistics:');
    console.log(`⏱️  Uptime: ${uptimeMinutes} minutes`);
    console.log(`🔗 Connections processed: ${stats.connectionsProcessed}`);
    console.log(`📍 Locations resolved: ${stats.locationsResolved}`);
    console.log(`👥 Active clients: ${stats.clientsConnected}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`💾 Geo cache size: ${stats.geoService.cacheSize}`);
    console.log('');
  }

  /**
   * Stops the agent and all components
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Live Traffic Globe Agent...');
    
    try {
      // Stop traffic monitoring
      this.trafficMonitor.stop();
      
      // Stop WebSocket server
      this.wsServer.stop();
      
      // Clear geolocation cache
      this.geoService.clearCache();
      
      this.isRunning = false;
      console.log('✅ Agent stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping agent:', error.message);
    }
  }
}

// Create and start the agent if this file is run directly
if (require.main === module) {
  const agent = new LiveTrafficAgent();
  
  // Print stats every 30 seconds
  setInterval(() => {
    if (agent.isRunning) {
      agent.printStats();
    }
  }, 30000);
  
  agent.start().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = LiveTrafficAgent;