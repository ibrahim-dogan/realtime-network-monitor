const { spawn } = require('child_process');
const EventEmitter = require('events');
const CONFIG = require('../config');
const IPFilter = require('../utils/IPFilter');
const ProcessColorizer = require('../utils/ProcessColorizer');

/**
 * TrafficMonitor class for spawning and managing nettop subprocess
 * to monitor network traffic and extract destination IP addresses
 */
class TrafficMonitor extends EventEmitter {
  constructor() {
    super();
    this.nettopProcess = null;
    this.isRunning = false;
    this.ipFilter = new IPFilter();
    this.processColorizer = new ProcessColorizer();
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    this.restartDelay = 1000; // Start with 1 second delay
    
    // Deduplication and connection state tracking
    this.processedIPs = new Set(); // Track processed IPs to avoid duplicates
    this.connectionStates = new Map(); // Track connection states by unique key
    this.ipLastSeen = new Map(); // Track when IPs were last seen for cleanup
    this.cleanupInterval = null;
    this.ipCacheTimeout = 10000; // 10 seconds cache timeout for more real-time display
    this.connectionCacheTimeout = 5000; // 5 seconds connection cache timeout for real-time
  }

  /**
   * Starts the network traffic monitoring - tries nettop first, falls back to lsof
   */
  start() {
    if (this.isRunning) {
      console.log('[TrafficMonitor] Already running');
      return;
    }

    console.log('[TrafficMonitor] Starting network traffic monitoring...');
    
    try {
      this.isRunning = true;
      this.restartAttempts = 0;
      
      // Start cleanup interval for cache management
      this.startCleanupInterval();
      
      // Try continuous monitoring first (nettop), fall back to periodic (lsof)
      this.tryStartContinuousMonitoring();

      console.log('[TrafficMonitor] Network monitoring started successfully');
      this.emit('started');

    } catch (error) {
      console.error('[TrafficMonitor] Failed to start:', error.message);
      this.isRunning = false;
      this.emit('error', error);
    }
  }

  /**
   * Tries to start continuous monitoring, falls back to periodic if needed
   */
  tryStartContinuousMonitoring() {
    // nettop doesn't provide the connection details we need, so use lsof directly
    console.log('[TrafficMonitor] Using lsof for real-time connection monitoring...');
    this.startPeriodicMonitoring();
  }

  /**
   * Starts continuous real-time monitoring using nettop for live traffic capture
   */
  startContinuousMonitoring() {
    if (!this.isRunning) return;

    console.log('[TrafficMonitor] Starting continuous nettop monitoring...');

    // Use nettop for continuous real-time monitoring
    // -P: Don't resolve port names, -l 0: Continuous logging, -n: No name resolution
    this.nettopProcess = spawn('nettop', ['-P', '-n', '-l', '0'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let outputBuffer = '';
    let hasReceivedData = false;

    this.nettopProcess.stdout.on('data', (data) => {
      hasReceivedData = true;
      outputBuffer += data.toString();
      
      // Process complete lines
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      if (lines.length > 0) {
        this.parseTrafficData(lines.join('\n'));
      }
    });

    this.nettopProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      if (errorMsg && !errorMsg.includes('nettop:') && !errorMsg.includes('Sampling')) {
        console.error(`[TrafficMonitor] nettop stderr: ${errorMsg}`);
        
        // If we get permission errors, fall back to lsof
        if (errorMsg.includes('Permission') || errorMsg.includes('denied')) {
          console.log('[TrafficMonitor] nettop permission denied, falling back to lsof...');
          this.nettopProcess.kill();
          this.startPeriodicMonitoring();
          return;
        }
      }
    });

    this.nettopProcess.on('close', (code) => {
      console.log(`[TrafficMonitor] nettop process closed with code ${code}`);
      
      // If nettop closes immediately without receiving data, fall back to lsof
      if (!hasReceivedData && code === 0) {
        console.log('[TrafficMonitor] nettop closed immediately, likely needs sudo. Falling back to lsof...');
        this.startPeriodicMonitoring();
        return;
      }
      
      if (this.isRunning && this.restartAttempts < this.maxRestartAttempts) {
        console.log('[TrafficMonitor] Attempting to restart nettop...');
        this.attemptRestart();
      } else if (code !== 0) {
        console.log('[TrafficMonitor] nettop failed, falling back to lsof...');
        this.startPeriodicMonitoring();
      }
    });

    this.nettopProcess.on('error', (error) => {
      console.error('[TrafficMonitor] nettop error:', error.message);
      
      if (error.code === 'ENOENT') {
        console.log('[TrafficMonitor] nettop not found, falling back to lsof...');
        this.startPeriodicMonitoring();
      } else if (error.code === 'EACCES') {
        console.log('[TrafficMonitor] nettop permission denied, falling back to lsof...');
        this.startPeriodicMonitoring();
      } else {
        console.log('[TrafficMonitor] nettop failed, falling back to lsof...');
        this.startPeriodicMonitoring();
      }
    });

    // Set a timeout to check if nettop is working
    setTimeout(() => {
      if (!hasReceivedData && this.nettopProcess && !this.nettopProcess.killed) {
        console.log('[TrafficMonitor] nettop timeout - no data received, falling back to lsof...');
        this.nettopProcess.kill();
        this.startPeriodicMonitoring();
      }
    }, 3000); // 3 second timeout
  }

  /**
   * Starts periodic monitoring using lsof as fallback
   */
  startPeriodicMonitoring() {
    if (!this.isRunning) return;

    console.log('[TrafficMonitor] Starting periodic lsof monitoring (fallback mode)...');

    const runLsof = () => {
      if (!this.isRunning) return;

      const lsofProcess = spawn('lsof', ['-i', '-P', '-n'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let outputData = '';

      lsofProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      lsofProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString().trim();
        if (errorMsg && !errorMsg.includes('lsof: WARNING')) {
          console.error(`[TrafficMonitor] lsof stderr: ${errorMsg}`);
        }
      });

      lsofProcess.on('close', (code) => {
        if (code === 0 && outputData) {
          this.parseConnectionData(outputData);
        }
        
        // Schedule next monitoring cycle with shorter interval for more real-time feel
        if (this.isRunning) {
          setTimeout(runLsof, 500); // Check every 500ms for more responsive monitoring
        }
      });

      lsofProcess.on('error', (error) => {
        console.error('[TrafficMonitor] lsof error:', error.message);
        
        if (error.code === 'ENOENT') {
          this.emit('error', new Error('lsof command not found. This tool requires lsof to be installed.'));
        } else {
          // Retry after a delay
          if (this.isRunning) {
            setTimeout(runLsof, 2000);
          }
        }
      });
    };

    runLsof();
  }

  /**
   * Stops the network traffic monitoring
   */
  stop() {
    if (!this.isRunning) {
      console.log('[TrafficMonitor] Not running');
      return;
    }

    console.log('[TrafficMonitor] Stopping network traffic monitoring...');
    this.isRunning = false;
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear caches
    this.processedIPs.clear();
    this.connectionStates.clear();
    this.ipLastSeen.clear();
  }

  /**
   * Attempts to restart the nettop process with exponential backoff
   */
  attemptRestart() {
    this.restartAttempts++;
    const delay = this.restartDelay * Math.pow(2, this.restartAttempts - 1);
    
    console.log(`[TrafficMonitor] Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.restartAttempts <= this.maxRestartAttempts) {
        this.start();
      } else {
        console.error('[TrafficMonitor] Max restart attempts reached');
        this.emit('error', new Error('Failed to restart nettop after multiple attempts'));
      }
    }, delay);
  }

  /**
   * Parses lsof output to extract connection information with deduplication
   * @param {string} data - Raw lsof output data
   */
  parseConnectionData(data) {
    try {
      const lines = data.split('\n').filter(line => line.trim());
      const currentConnections = new Set();
      let newConnectionsCount = 0;
      let duplicatesFiltered = 0;
      
      console.log(`[TrafficMonitor] Processing ${lines.length} lines from lsof`);
      
      for (const line of lines) {
        // Skip header lines and empty lines
        if (line.includes('COMMAND') || line.includes('PID') || !line.trim()) {
          continue;
        }

        // Parse lsof output format
        const connectionData = this.parseLsofLine(line);
        
        if (connectionData && connectionData.destIP) {
          // Create unique connection key for state tracking
          const connectionKey = `${connectionData.processName}:${connectionData.sourceIP}:${connectionData.sourcePort}->${connectionData.destIP}:${connectionData.destPort}`;
          currentConnections.add(connectionKey);
          
          // Filter out private/local IPs first
          if (this.ipFilter.isPrivateIP(connectionData.destIP)) {
            continue;
          }
          
          // Check if this is a new connection we haven't processed recently
          if (this.isNewConnection(connectionKey, connectionData.destIP)) {
            // Enhance connection data with process classification
            const enhancedConnectionData = this.enhanceConnectionData(connectionData);
            
            console.log(`[TrafficMonitor] New connection: ${enhancedConnectionData.processName} (${enhancedConnectionData.processType}) -> ${enhancedConnectionData.destIP}:${enhancedConnectionData.destPort}`);
            
            // Update tracking state
            this.updateConnectionState(connectionKey, connectionData.destIP);
            
            // Emit traffic event for new connections only
            this.emit('traffic', enhancedConnectionData);
            newConnectionsCount++;
          } else {
            duplicatesFiltered++;
          }
        }
      }
      
      // Clean up stale connections that are no longer active
      this.cleanupStaleConnections(currentConnections);
      
      if (newConnectionsCount > 0 || duplicatesFiltered > 0) {
        console.log(`[TrafficMonitor] Processed: ${newConnectionsCount} new connections, ${duplicatesFiltered} duplicates filtered`);
      }
    } catch (error) {
      console.error('[TrafficMonitor] Error parsing connection data:', error.message);
    }
  }

  /**
   * Parses nettop output to extract destination IP addresses with real-time processing
   * @param {string} data - Raw nettop output data
   */
  parseTrafficData(data) {
    try {
      const lines = data.split('\n').filter(line => line.trim());
      let newConnectionsCount = 0;
      let duplicatesFiltered = 0;
      
      for (const line of lines) {
        // Skip header lines and empty lines
        if (line.includes('time') || line.includes('---') || line.includes('Sampling') || !line.trim()) {
          continue;
        }

        // Parse nettop output format
        const trafficData = this.parseNettopLine(line);
        
        if (trafficData && trafficData.destIP) {
          // Filter out private/local IPs first
          if (this.ipFilter.isPrivateIP(trafficData.destIP)) {
            continue;
          }
          
          // Create connection key for deduplication
          const connectionKey = `${trafficData.processName}:${trafficData.sourceIP}:${trafficData.sourcePort}->${trafficData.destIP}:${trafficData.destPort}`;
          
          // For nettop, be less aggressive with deduplication since it's real-time
          if (this.isNewConnectionForRealTime(connectionKey, trafficData.destIP)) {
            // Enhance traffic data with process classification
            const enhancedTrafficData = this.enhanceConnectionData(trafficData);
            
            console.log(`[TrafficMonitor] Real-time connection: ${enhancedTrafficData.processName} (${enhancedTrafficData.processType}) -> ${enhancedTrafficData.destIP}:${enhancedTrafficData.destPort}`);
            
            // Update tracking state
            this.updateConnectionState(connectionKey, trafficData.destIP);
            
            // Emit traffic event
            this.emit('traffic', enhancedTrafficData);
            newConnectionsCount++;
          } else {
            duplicatesFiltered++;
          }
        }
      }
      
      if (newConnectionsCount > 0) {
        console.log(`[TrafficMonitor] Real-time processed: ${newConnectionsCount} new connections, ${duplicatesFiltered} duplicates filtered`);
      }
    } catch (error) {
      console.error('[TrafficMonitor] Error parsing traffic data:', error.message);
    }
  }

  /**
   * Parses a single line of lsof output
   * @param {string} line - Single line from lsof output
   * @returns {Object|null} - Parsed connection data or null if invalid
   */
  parseLsofLine(line) {
    try {
      // lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      // Example: Chrome 1234 user 123u IPv4 0x123456 0t0 TCP 192.168.1.100:12345->1.2.3.4:443 (ESTABLISHED)
      
      // Look for TCP connections with ESTABLISHED state first
      if (!line.includes('TCP') || !line.includes('ESTABLISHED')) {
        return null;
      }
      
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;
      
      const processName = parts[0];
      
      // Find the connection pattern anywhere in the line
      const connectionRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)->(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/;
      const match = line.match(connectionRegex);
      
      if (match) {
        const [, sourceIP, sourcePort, destIP, destPort] = match;
        
        return {
          processName: processName,
          sourceIP: sourceIP,
          sourcePort: parseInt(sourcePort, 10),
          destIP: destIP,
          destPort: parseInt(destPort, 10),
          timestamp: Date.now(),
          rawLine: line
        };
      }
      
      return null;
    } catch (error) {
      console.error('[TrafficMonitor] Error parsing lsof line:', error.message);
      return null;
    }
  }

  /**
   * Parses a single line of nettop output (legacy method)
   * @param {string} line - Single line from nettop output
   * @returns {Object|null} - Parsed traffic data or null if invalid
   */
  parseNettopLine(line) {
    try {
      // Look for connection patterns like "source->destination"
      const connectionRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)->(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/;
      const match = line.match(connectionRegex);
      
      if (match) {
        const [, sourceIP, sourcePort, destIP, destPort] = match;
        
        // Extract process name (usually at the beginning of the line)
        const processMatch = line.match(/^([^,\s]+)/);
        const processName = processMatch ? processMatch[1] : 'unknown';
        
        return {
          processName: processName,
          sourceIP: sourceIP,
          sourcePort: parseInt(sourcePort, 10),
          destIP: destIP,
          destPort: parseInt(destPort, 10),
          timestamp: Date.now(),
          rawLine: line
        };
      }
      
      return null;
    } catch (error) {
      console.error('[TrafficMonitor] Error parsing line:', error.message);
      return null;
    }
  }

  /**
   * Starts the cleanup interval for managing cache timeouts
   */
  startCleanupInterval() {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 30000);
  }

  /**
   * Checks if a connection is new and should be processed
   * @param {string} connectionKey - Unique connection identifier
   * @param {string} destIP - Destination IP address
   * @returns {boolean} - True if this is a new connection
   */
  isNewConnection(connectionKey, destIP) {
    const now = Date.now();
    
    // Check if we've seen this exact connection recently
    const connectionLastSeen = this.connectionStates.get(connectionKey);
    if (connectionLastSeen && (now - connectionLastSeen) < this.connectionCacheTimeout) {
      return false; // Connection seen recently, not new
    }
    
    // Check if we've processed this IP recently (broader deduplication)
    const ipLastSeen = this.ipLastSeen.get(destIP);
    if (ipLastSeen && (now - ipLastSeen) < this.ipCacheTimeout) {
      return false; // IP processed recently, not new
    }
    
    return true; // This is a new connection
  }

  /**
   * Checks if a connection is new for real-time monitoring (less aggressive deduplication)
   * @param {string} connectionKey - Unique connection identifier
   * @param {string} destIP - Destination IP address
   * @returns {boolean} - True if this is a new connection
   */
  isNewConnectionForRealTime(connectionKey, destIP) {
    const now = Date.now();
    
    // For real-time monitoring, only check exact connection duplicates with shorter timeout
    const connectionLastSeen = this.connectionStates.get(connectionKey);
    if (connectionLastSeen && (now - connectionLastSeen) < 2000) { // Only 2 seconds for real-time
      return false; // Same exact connection seen very recently
    }
    
    // Allow same IP connections more frequently for real-time display
    const ipLastSeen = this.ipLastSeen.get(destIP);
    if (ipLastSeen && (now - ipLastSeen) < 3000) { // Only 3 seconds for IP deduplication
      return false; // Same IP seen very recently
    }
    
    return true; // This is a new connection for real-time display
  }

  /**
   * Updates the connection state tracking
   * @param {string} connectionKey - Unique connection identifier
   * @param {string} destIP - Destination IP address
   */
  updateConnectionState(connectionKey, destIP) {
    const now = Date.now();
    
    // Update connection state
    this.connectionStates.set(connectionKey, now);
    
    // Update IP last seen
    this.ipLastSeen.set(destIP, now);
    
    // Add to processed IPs set
    this.processedIPs.add(destIP);
  }

  /**
   * Cleans up stale connections that are no longer active
   * @param {Set} currentConnections - Set of currently active connection keys
   */
  cleanupStaleConnections(currentConnections) {
    // Remove connection states for connections that are no longer active
    const staleConnections = [];
    for (const [connectionKey] of this.connectionStates) {
      if (!currentConnections.has(connectionKey)) {
        staleConnections.push(connectionKey);
      }
    }
    
    for (const connectionKey of staleConnections) {
      this.connectionStates.delete(connectionKey);
    }
    
    if (staleConnections.length > 0) {
      console.log(`[TrafficMonitor] Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  /**
   * Cleans up expired entries from caches based on timeouts
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let expiredConnections = 0;
    let expiredIPs = 0;
    
    // Clean up expired connection states
    for (const [connectionKey, timestamp] of this.connectionStates) {
      if (now - timestamp > this.connectionCacheTimeout) {
        this.connectionStates.delete(connectionKey);
        expiredConnections++;
      }
    }
    
    // Clean up expired IP entries
    for (const [ip, timestamp] of this.ipLastSeen) {
      if (now - timestamp > this.ipCacheTimeout) {
        this.ipLastSeen.delete(ip);
        this.processedIPs.delete(ip);
        expiredIPs++;
      }
    }
    
    if (expiredConnections > 0 || expiredIPs > 0) {
      console.log(`[TrafficMonitor] Cache cleanup: ${expiredConnections} connections, ${expiredIPs} IPs expired`);
    }
  }

  /**
   * Enhances connection data with process classification and color information
   * @param {Object} connectionData - Raw connection data
   * @returns {Object} - Enhanced connection data with process type and color info
   */
  enhanceConnectionData(connectionData) {
    // Get process classification and color information
    const processColorInfo = this.processColorizer.getProcessColorInfo(connectionData.processName);
    
    // Create enhanced connection data with all required fields for WebSocket message
    return {
      ...connectionData,
      processType: processColorInfo.processType,
      primaryColor: processColorInfo.primaryColor,
      gradientColors: processColorInfo.gradientColors,
      colorScheme: processColorInfo.colorScheme
    };
  }

  /**
   * Gets deduplication statistics
   * @returns {Object} - Statistics about cached data
   */
  getDeduplicationStats() {
    return {
      processedIPsCount: this.processedIPs.size,
      connectionStatesCount: this.connectionStates.size,
      ipLastSeenCount: this.ipLastSeen.size,
      isCleanupRunning: this.cleanupInterval !== null
    };
  }

  /**
   * Gets the current status of the traffic monitor
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processId: this.nettopProcess ? this.nettopProcess.pid : null,
      restartAttempts: this.restartAttempts,
      maxRestartAttempts: this.maxRestartAttempts,
      deduplication: this.getDeduplicationStats()
    };
  }
}

module.exports = TrafficMonitor;