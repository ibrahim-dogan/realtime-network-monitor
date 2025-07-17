/**
 * StatusDisplay component for connection and system status
 * Manages UI state and displays information to users
 */
class StatusDisplay {
  constructor(containerId, config = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // Configuration
    this.config = {
      updateInterval: 1000, // Update every second
      showDetailedStats: false,
      autoHide: false,
      autoHideDelay: 5000,
      theme: 'dark',
      position: 'top-left',
      ...config
    };
    
    // State
    this.isVisible = true;
    this.updateTimer = null;
    this.autoHideTimer = null;
    this.lastUpdate = null;
    
    // Status data
    this.status = {
      connection: 'disconnected',
      location: null,
      stats: null,
      errors: [],
      lastTraffic: null
    };
    
    // UI elements
    this.elements = {};
    
    this.initialize();
  }

  /**
   * Initializes the status display UI
   */
  initialize() {
    if (!this.container) {
      console.error(`[StatusDisplay] Container element with ID '${this.containerId}' not found`);
      return;
    }

    console.log('[StatusDisplay] Initializing status display...');
    
    this.createUI();
    this.applyTheme();
    this.startUpdateTimer();
    
    console.log('[StatusDisplay] Status display initialized');
  }

  /**
   * Creates the UI structure
   */
  createUI() {
    this.container.innerHTML = `
      <div class="status-panel ${this.config.position}">
        <div class="status-header">
          <h2 class="status-title">🌍 Live Traffic Globe</h2>
          <button class="status-toggle" title="Toggle Details">📊</button>
          <button class="status-close" title="Hide Panel">✕</button>
        </div>
        
        <div class="status-main">
          <div class="status-item">
            <span class="status-label">Connection:</span>
            <span class="status-value connection-status" id="connection-status">Connecting...</span>
          </div>
          
          <div class="status-item">
            <span class="status-label">Your Location:</span>
            <span class="status-value" id="location-status">Acquiring...</span>
          </div>
          
          <div class="status-item">
            <span class="status-label">Last Traffic:</span>
            <span class="status-value" id="last-traffic">None</span>
          </div>
        </div>
        
        <div class="status-details" id="status-details" style="display: none;">
          <div class="status-section">
            <h4>Statistics</h4>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Active Arcs:</span>
                <span class="stat-value" id="active-arcs">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Connections:</span>
                <span class="stat-value" id="total-connections">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Uptime:</span>
                <span class="stat-value" id="uptime">0s</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Errors:</span>
                <span class="stat-value" id="error-count">0</span>
              </div>
            </div>
          </div>
          
          <div class="status-section">
            <h4>Recent Traffic</h4>
            <div class="traffic-list" id="traffic-list">
              <div class="no-traffic">No recent traffic</div>
            </div>
          </div>
          
          <div class="status-section">
            <h4>System Info</h4>
            <div class="system-info" id="system-info">
              <div class="info-item">
                <span class="info-label">Browser:</span>
                <span class="info-value" id="browser-info">Unknown</span>
              </div>
              <div class="info-item">
                <span class="info-label">WebGL:</span>
                <span class="info-value" id="webgl-support">Unknown</span>
              </div>
              <div class="info-item">
                <span class="info-label">Geolocation:</span>
                <span class="info-value" id="geo-support">Unknown</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="status-errors" id="status-errors" style="display: none;">
          <h4>⚠️ Errors & Warnings</h4>
          <div class="error-list" id="error-list"></div>
        </div>
      </div>
    `;

    // Get references to UI elements
    this.elements = {
      panel: this.container.querySelector('.status-panel'),
      connectionStatus: this.container.querySelector('#connection-status'),
      locationStatus: this.container.querySelector('#location-status'),
      lastTraffic: this.container.querySelector('#last-traffic'),
      details: this.container.querySelector('#status-details'),
      toggleButton: this.container.querySelector('.status-toggle'),
      closeButton: this.container.querySelector('.status-close'),
      activeArcs: this.container.querySelector('#active-arcs'),
      totalConnections: this.container.querySelector('#total-connections'),
      uptime: this.container.querySelector('#uptime'),
      errorCount: this.container.querySelector('#error-count'),
      trafficList: this.container.querySelector('#traffic-list'),
      systemInfo: this.container.querySelector('#system-info'),
      statusErrors: this.container.querySelector('#status-errors'),
      errorList: this.container.querySelector('#error-list')
    };

    this.setupEventListeners();
    this.updateSystemInfo();
  }

  /**
   * Sets up event listeners for UI interactions
   */
  setupEventListeners() {
    // Toggle details
    this.elements.toggleButton.addEventListener('click', () => {
      this.toggleDetails();
    });

    // Close panel
    this.elements.closeButton.addEventListener('click', () => {
      this.hide();
    });

    // Panel hover (cancel auto-hide)
    this.elements.panel.addEventListener('mouseenter', () => {
      this.cancelAutoHide();
    });

    this.elements.panel.addEventListener('mouseleave', () => {
      if (this.config.autoHide) {
        this.scheduleAutoHide();
      }
    });
  }

  /**
   * Applies the selected theme
   */
  applyTheme() {
    const styles = `
      <style id="status-display-styles">
        .status-panel {
          position: fixed;
          background: ${this.config.theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)'};
          color: ${this.config.theme === 'dark' ? '#ffffff' : '#000000'};
          border: 1px solid ${this.config.theme === 'dark' ? '#333' : '#ccc'};
          border-radius: 8px;
          padding: 15px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          min-width: 280px;
          max-width: 400px;
          z-index: 1000;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .status-panel.top-left { top: 20px; left: 20px; }
        .status-panel.top-right { top: 20px; right: 20px; }
        .status-panel.bottom-left { bottom: 20px; left: 20px; }
        .status-panel.bottom-right { bottom: 20px; right: 20px; }
        
        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 1px solid ${this.config.theme === 'dark' ? '#444' : '#ddd'};
          padding-bottom: 10px;
        }
        
        .status-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .status-toggle, .status-close {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
          border-radius: 4px;
          margin-left: 5px;
        }
        
        .status-toggle:hover, .status-close:hover {
          background: ${this.config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        }
        
        .status-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          align-items: center;
        }
        
        .status-label {
          font-weight: 500;
          opacity: 0.8;
        }
        
        .status-value {
          font-weight: 600;
        }
        
        .connection-status.connected { color: #4CAF50; }
        .connection-status.connecting { color: #FF9800; }
        .connection-status.disconnected { color: #F44336; }
        .connection-status.error { color: #F44336; }
        
        .status-details {
          margin-top: 15px;
          border-top: 1px solid ${this.config.theme === 'dark' ? '#444' : '#ddd'};
          padding-top: 15px;
        }
        
        .status-section {
          margin-bottom: 15px;
        }
        
        .status-section h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          opacity: 0.9;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        
        .stat-item, .info-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }
        
        .stat-label, .info-label {
          opacity: 0.7;
        }
        
        .stat-value, .info-value {
          font-weight: 600;
        }
        
        .traffic-list {
          max-height: 120px;
          overflow-y: auto;
          font-size: 12px;
        }
        
        .traffic-item {
          padding: 4px 0;
          border-bottom: 1px solid ${this.config.theme === 'dark' ? '#333' : '#eee'};
        }
        
        .traffic-item:last-child {
          border-bottom: none;
        }
        
        .no-traffic {
          opacity: 0.6;
          font-style: italic;
          text-align: center;
          padding: 10px;
        }
        
        .status-errors {
          margin-top: 15px;
          border-top: 1px solid #F44336;
          padding-top: 10px;
        }
        
        .error-item {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 5px;
          font-size: 12px;
        }
        
        .error-time {
          opacity: 0.7;
          font-size: 11px;
        }
        
        @media (max-width: 480px) {
          .status-panel {
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            right: 10px !important;
            max-width: none;
          }
        }
      </style>
    `;

    // Remove existing styles
    const existingStyles = document.getElementById('status-display-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    // Add new styles
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Updates system information
   */
  updateSystemInfo() {
    // Browser info
    const browserInfo = this.getBrowserInfo();
    this.elements.systemInfo.querySelector('#browser-info').textContent = browserInfo;

    // WebGL support
    const webglSupport = this.checkWebGLSupport();
    const webglElement = this.elements.systemInfo.querySelector('#webgl-support');
    webglElement.textContent = webglSupport ? 'Supported' : 'Not Supported';
    webglElement.style.color = webglSupport ? '#4CAF50' : '#F44336';

    // Geolocation support
    const geoSupport = 'geolocation' in navigator;
    const geoElement = this.elements.systemInfo.querySelector('#geo-support');
    geoElement.textContent = geoSupport ? 'Supported' : 'Not Supported';
    geoElement.style.color = geoSupport ? '#4CAF50' : '#F44336';
  }

  /**
   * Gets browser information
   * @returns {string} - Browser name and version
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Chrome')) {
      browser = 'Chrome';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Safari')) {
      browser = 'Safari';
    } else if (ua.includes('Edge')) {
      browser = 'Edge';
    }

    return browser;
  }

  /**
   * Checks WebGL support
   * @returns {boolean} - True if WebGL is supported
   */
  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Updates connection status
   * @param {string} status - Connection status
   * @param {string} message - Status message
   */
  updateConnectionStatus(status, message = '') {
    this.status.connection = status;
    
    const element = this.elements.connectionStatus;
    element.className = `status-value connection-status ${status}`;
    
    switch (status) {
      case 'connected':
        element.textContent = '🟢 Connected';
        break;
      case 'connecting':
        element.textContent = '🟡 Connecting...';
        break;
      case 'disconnected':
        element.textContent = '🔴 Disconnected';
        break;
      case 'error':
        element.textContent = '❌ Error';
        break;
      default:
        element.textContent = message || status;
    }
    
    this.lastUpdate = Date.now();
  }

  /**
   * Updates location status
   * @param {Object} location - Location data
   */
  updateLocationStatus(location) {
    this.status.location = location;
    
    if (location) {
      const text = location.name || 
                   `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;
      this.elements.locationStatus.textContent = text;
    } else {
      this.elements.locationStatus.textContent = 'Unknown';
    }
    
    this.lastUpdate = Date.now();
  }

  /**
   * Updates statistics
   * @param {Object} stats - Statistics data
   */
  updateStats(stats) {
    this.status.stats = stats;
    
    if (stats) {
      this.elements.activeArcs.textContent = stats.currentArcs || 0;
      this.elements.totalConnections.textContent = stats.connectionsProcessed || 0;
      this.elements.errorCount.textContent = stats.errors || 0;
      
      // Format uptime
      const uptime = stats.uptime || 0;
      this.elements.uptime.textContent = this.formatUptime(uptime);
    }
    
    this.lastUpdate = Date.now();
  }

  /**
   * Adds a traffic event to the display
   * @param {Object} trafficData - Traffic data
   */
  addTrafficEvent(trafficData) {
    // Handle invalid or null traffic data
    if (!trafficData || typeof trafficData !== 'object') {
      console.warn('[StatusDisplay] Invalid traffic data provided:', trafficData);
      return;
    }
    
    this.status.lastTraffic = trafficData;
    
    // Update last traffic display with safe property access
    const city = trafficData.city || 'Unknown';
    const country = trafficData.country || 'Unknown';
    const ip = trafficData.ip || 'Unknown IP';
    const destination = `${city}, ${country}`;
    
    if (this.elements.lastTraffic) {
      this.elements.lastTraffic.textContent = `${ip} (${destination})`;
    }
    
    // Add to traffic list
    this.addToTrafficList(trafficData);
    
    this.lastUpdate = Date.now();
  }

  /**
   * Adds traffic item to the recent traffic list
   * @param {Object} trafficData - Traffic data
   */
  addToTrafficList(trafficData) {
    if (!this.elements.trafficList) {
      return;
    }
    
    const trafficList = this.elements.trafficList;
    
    // Remove "no traffic" message
    const noTraffic = trafficList.querySelector('.no-traffic');
    if (noTraffic) {
      noTraffic.remove();
    }
    
    // Safe property access with defaults
    const ip = trafficData.ip || 'Unknown IP';
    const city = trafficData.city || 'Unknown';
    const country = trafficData.country || 'Unknown';
    const process = trafficData.process || 'Unknown';
    const port = trafficData.port || 'Unknown';
    
    // Create traffic item
    const item = document.createElement('div');
    item.className = 'traffic-item';
    item.innerHTML = `
      <div><strong>${ip}</strong> → ${city}, ${country}</div>
      <div style="font-size: 11px; opacity: 0.7;">
        ${process} • Port ${port} • ${new Date().toLocaleTimeString()}
      </div>
    `;
    
    // Add to top of list
    trafficList.insertBefore(item, trafficList.firstChild);
    
    // Limit to 10 items
    const items = trafficList.querySelectorAll('.traffic-item');
    if (items.length > 10) {
      items[items.length - 1].remove();
    }
  }

  /**
   * Adds an error message
   * @param {string} message - Error message
   * @param {string} type - Error type
   */
  addError(message, type = 'error') {
    const error = {
      message,
      type,
      timestamp: Date.now()
    };
    
    this.status.errors.push(error);
    
    // Show errors section
    this.elements.statusErrors.style.display = 'block';
    
    // Add error to list
    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';
    errorItem.innerHTML = `
      <div>${message}</div>
      <div class="error-time">${new Date().toLocaleTimeString()}</div>
    `;
    
    this.elements.errorList.insertBefore(errorItem, this.elements.errorList.firstChild);
    
    // Limit to 5 errors
    const errorItems = this.elements.errorList.querySelectorAll('.error-item');
    if (errorItems.length > 5) {
      errorItems[errorItems.length - 1].remove();
    }
    
    this.lastUpdate = Date.now();
  }

  /**
   * Clears all errors
   */
  clearErrors() {
    this.status.errors = [];
    this.elements.errorList.innerHTML = '';
    this.elements.statusErrors.style.display = 'none';
  }

  /**
   * Formats uptime duration
   * @param {number} ms - Milliseconds
   * @returns {string} - Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Toggles the details section
   */
  toggleDetails() {
    const isVisible = this.elements.details.style.display !== 'none';
    this.elements.details.style.display = isVisible ? 'none' : 'block';
    this.elements.toggleButton.textContent = isVisible ? '📊' : '📈';
  }

  /**
   * Shows the status panel
   */
  show() {
    this.isVisible = true;
    this.elements.panel.style.display = 'block';
    this.cancelAutoHide();
  }

  /**
   * Hides the status panel
   */
  hide() {
    this.isVisible = false;
    this.elements.panel.style.display = 'none';
    this.cancelAutoHide();
  }

  /**
   * Toggles panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Schedules auto-hide
   */
  scheduleAutoHide() {
    if (!this.config.autoHide) return;
    
    this.cancelAutoHide();
    this.autoHideTimer = setTimeout(() => {
      this.hide();
    }, this.config.autoHideDelay);
  }

  /**
   * Cancels auto-hide
   */
  cancelAutoHide() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  /**
   * Starts the update timer
   */
  startUpdateTimer() {
    this.stopUpdateTimer();
    
    this.updateTimer = setInterval(() => {
      // Update relative timestamps, etc.
      this.updateRelativeTimestamps();
    }, this.config.updateInterval);
  }

  /**
   * Stops the update timer
   */
  stopUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Updates relative timestamps in the UI
   */
  updateRelativeTimestamps() {
    // Update traffic item timestamps
    const trafficItems = this.elements.trafficList.querySelectorAll('.traffic-item');
    trafficItems.forEach(item => {
      // Could update relative time here if needed
    });
  }

  /**
   * Gets current status data
   * @returns {Object} - Status data
   */
  getStatus() {
    return {
      ...this.status,
      isVisible: this.isVisible,
      lastUpdate: this.lastUpdate,
      config: { ...this.config }
    };
  }

  /**
   * Updates configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.applyTheme();
  }

  /**
   * Destroys the status display
   */
  destroy() {
    console.log('[StatusDisplay] Destroying status display...');
    
    this.stopUpdateTimer();
    this.cancelAutoHide();
    
    // Remove styles
    const styles = document.getElementById('status-display-styles');
    if (styles) {
      styles.remove();
    }
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    console.log('[StatusDisplay] Status display destroyed');
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatusDisplay;
} else if (typeof window !== 'undefined') {
  window.StatusDisplay = StatusDisplay;
}