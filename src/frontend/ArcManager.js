/**
 * ArcManager class to handle traffic arc data and lifecycle
 * Manages arc creation, animation, and cleanup for performance
 */
class ArcManager {
  constructor(globe, config = {}) {
    this.globe = globe;
    this.arcs = new Map(); // Map of arc ID to arc data
    this.arcArray = []; // Array for globe.gl
    
    // Configuration
    this.config = {
      maxArcs: 50,
      arcLifetime: 30000, // 30 seconds
      animationDuration: 2000, // 2 seconds
      arcColor: '#00ffff',
      arcStroke: 0.5,
      arcDashLength: 0.4,
      arcDashGap: 0.2,
      arcDashAnimateTime: 2000,
      arcAltitude: 0.1,
      arcAltitudeAutoScale: 0.5,
      showLabels: true,
      labelSize: 1.2,
      labelColor: '#ffffff',
      labelResolution: 2,
      ...config
    };
    
    // Animation state
    this.animationId = null;
    this.lastCleanup = Date.now();
    this.cleanupInterval = 5000; // Clean up every 5 seconds
    
    // Statistics
    this.stats = {
      totalArcsCreated: 0,
      currentArcs: 0,
      arcsRemoved: 0
    };
    
    // Event handlers
    this.eventHandlers = {
      arcAdded: [],
      arcRemoved: [],
      arcClicked: [],
      arcHovered: []
    };
    
    this.setupGlobeArcs();
    this.startAnimationLoop();
  }

  /**
   * Sets up arc configuration on the globe
   */
  setupGlobeArcs() {
    if (!this.globe) {
      console.error('[ArcManager] Globe instance not provided');
      return;
    }

    try {
      this.globe
        // Arc data
        .arcsData(this.arcArray)
        
        // Arc appearance
        .arcColor(d => d.color || this.config.arcColor)
        .arcStroke(d => d.stroke || this.config.arcStroke)
        .arcDashLength(this.config.arcDashLength)
        .arcDashGap(this.config.arcDashGap)
        .arcDashAnimateTime(this.config.arcDashAnimateTime)
        
        // Arc coordinates
        .arcStartLat(d => d.startLat)
        .arcStartLng(d => d.startLon)
        .arcEndLat(d => d.endLat)
        .arcEndLng(d => d.endLon)
        
        // Arc altitude (height above surface)
        .arcAltitude(d => d.altitude || this.calculateArcAltitude(d))
        .arcAltitudeAutoScale(this.config.arcAltitudeAutoScale)
        
        // Arc labels
        .arcLabel(d => this.config.showLabels ? this.generateArcLabel(d) : '');
        
      // Set up arc interactions if available
      if (typeof this.globe.onArcClick === 'function') {
        this.globe.onArcClick((arc, event) => {
          this.emit('arcClicked', { arc, event });
        });
      }
      
      if (typeof this.globe.onArcHover === 'function') {
        this.globe.onArcHover((arc, prevArc) => {
          this.emit('arcHovered', { arc, prevArc });
        });
      }
      
      console.log('[ArcManager] Arc configuration setup completed');
      
    } catch (error) {
      console.error('[ArcManager] Error setting up arc configuration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Adds a new traffic arc with enhanced visual effects
   * @param {Object} trafficData - Traffic data from backend
   * @param {Object} userLocation - User's location
   */
  addArc(trafficData, userLocation) {
    try {
      if (!trafficData || !userLocation) {
        throw new Error('Invalid data for arc creation: missing trafficData or userLocation');
      }

      // Validate required fields
      if (!trafficData.lat || !trafficData.lon) {
        throw new Error('Invalid traffic data: missing latitude or longitude');
      }

      if (!userLocation.lat || !userLocation.lon) {
        throw new Error('Invalid user location: missing latitude or longitude');
      }

      const arcId = this.generateArcId(trafficData);
      
      // Check if arc already exists (avoid duplicates)
      if (this.arcs.has(arcId)) {
        console.log(`[ArcManager] Arc already exists: ${arcId}`);
        return this.arcs.get(arcId);
      }

      const arcData = {
        id: arcId,
        startLat: userLocation.lat,
        startLon: userLocation.lon,
        endLat: trafficData.lat,
        endLon: trafficData.lon,
        ip: trafficData.ip || 'Unknown',
        city: trafficData.city || 'Unknown',
        country: trafficData.country || 'Unknown',
        processName: trafficData.processName || trafficData.process,
        processType: trafficData.processType || 'other',
        primaryColor: trafficData.primaryColor,
        gradientColors: trafficData.gradientColors,
        colorScheme: trafficData.colorScheme,
        port: trafficData.port,
        timestamp: trafficData.timestamp || Date.now(),
        createdAt: Date.now(),
        color: this.getArcColor(trafficData),
        stroke: this.getArcStroke(trafficData),
        altitude: this.calculateArcAltitude({
          startLat: userLocation.lat,
          startLon: userLocation.lon,
          endLat: trafficData.lat,
          endLon: trafficData.lon
        })
      };

      // Add to collections
      this.arcs.set(arcId, arcData);
      this.arcArray.push(arcData);
      
      // Add visual effects
      this.addConnectionPoint(trafficData);
      this.addConnectionRing(trafficData);
      
      // Update globe with error handling
      try {
        this.updateGlobeArcs();
      } catch (updateError) {
        console.error('[ArcManager] Failed to update globe arcs:', updateError);
        // Remove the arc we just added since update failed
        this.arcs.delete(arcId);
        this.arcArray.pop();
        throw new Error(`Failed to update globe visualization: ${updateError.message}`);
      }
      
      // Update statistics
      this.stats.totalArcsCreated++;
      this.stats.currentArcs = this.arcs.size;
      
      console.log(`[ArcManager] Added enhanced arc: ${trafficData.ip} -> ${trafficData.city}, ${trafficData.country}`);
      
      this.emit('arcAdded', arcData);
      
      return arcData;

    } catch (error) {
      console.error('[ArcManager] Error adding arc:', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Removes an arc by ID
   * @param {string} arcId - Arc ID to remove
   */
  removeArc(arcId) {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return false;
    }

    // Remove from collections
    this.arcs.delete(arcId);
    const index = this.arcArray.findIndex(a => a.id === arcId);
    if (index > -1) {
      this.arcArray.splice(index, 1);
    }

    // Update globe
    this.updateGlobeArcs();
    
    // Update statistics
    this.stats.arcsRemoved++;
    this.stats.currentArcs = this.arcs.size;
    
    console.log(`[ArcManager] Removed arc: ${arcId}`);
    
    this.emit('arcRemoved', arc);
    
    return true;
  }

  /**
   * Cleans up old arcs based on lifetime and max count
   */
  cleanupArcs() {
    const now = Date.now();
    const arcsToRemove = [];

    // Find expired arcs
    for (const [arcId, arc] of this.arcs) {
      const age = now - arc.createdAt;
      if (age > this.config.arcLifetime) {
        arcsToRemove.push(arcId);
      }
    }

    // Remove expired arcs
    arcsToRemove.forEach(arcId => this.removeArc(arcId));

    // Remove oldest arcs if we exceed max count
    if (this.arcs.size > this.config.maxArcs) {
      const sortedArcs = Array.from(this.arcs.values())
        .sort((a, b) => a.createdAt - b.createdAt);
      
      const excessCount = this.arcs.size - this.config.maxArcs;
      for (let i = 0; i < excessCount; i++) {
        this.removeArc(sortedArcs[i].id);
      }
    }

    if (arcsToRemove.length > 0) {
      console.log(`[ArcManager] Cleaned up ${arcsToRemove.length} old arcs`);
    }
  }

  /**
   * Updates the globe with current arc data
   */
  updateGlobeArcs() {
    if (this.globe) {
      this.globe.arcsData([...this.arcArray]);
    }
  }

  /**
   * Generates a unique arc ID
   * @param {Object} trafficData - Traffic data
   * @returns {string} - Unique arc ID
   */
  generateArcId(trafficData) {
    const timestamp = trafficData.timestamp || Date.now();
    const hash = this.simpleHash(`${trafficData.ip}_${trafficData.port}_${timestamp}`);
    return `arc_${hash}`;
  }

  /**
   * Simple hash function for generating IDs
   * @param {string} str - String to hash
   * @returns {string} - Hash string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculates arc altitude based on distance
   * @param {Object} arc - Arc data with coordinates
   * @returns {number} - Arc altitude
   */
  calculateArcAltitude(arc) {
    const distance = this.calculateDistance(
      arc.startLat, arc.startLon,
      arc.endLat, arc.endLon
    );
    
    // Scale altitude based on distance (longer arcs are higher)
    const maxDistance = 20000; // ~half Earth circumference in km
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    
    return this.config.arcAltitude + (normalizedDistance * 0.3);
  }

  /**
   * Calculates distance between two coordinates in kilometers
   * @param {number} lat1 - Start latitude
   * @param {number} lon1 - Start longitude
   * @param {number} lat2 - End latitude
   * @param {number} lon2 - End longitude
   * @returns {number} - Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} - Radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Gets arc color based on traffic data with process-specific colors and beautiful gradients
   * @param {Object} trafficData - Traffic data with process classification
   * @returns {string} - Color string
   */
  getArcColor(trafficData) {
    // Use process-specific color if available (from backend ProcessColorizer)
    if (trafficData.primaryColor) {
      const distance = this.calculateDistance(
        trafficData.startLat || 0, trafficData.startLon || 0,
        trafficData.endLat || trafficData.lat, trafficData.endLon || trafficData.lon
      );
      
      // Add intensity based on distance (longer connections are brighter)
      const maxDistance = 20000;
      const intensity = Math.min(distance / maxDistance, 1);
      const alpha = 0.7 + (intensity * 0.3); // 0.7 to 1.0 opacity for better visibility
      
      // Convert hex to rgba for transparency
      const hex = trafficData.primaryColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // Fallback to port-based colors if process color not available
    const port = trafficData.port;
    const distance = this.calculateDistance(
      trafficData.startLat || 0, trafficData.startLon || 0,
      trafficData.endLat || trafficData.lat, trafficData.endLon || trafficData.lon
    );
    
    // Base colors by port type with enhanced cyber aesthetics
    let baseColor;
    if (port === 443 || port === 80) {
      baseColor = '#10b981'; // Emerald for HTTP/HTTPS
    } else if (port === 22) {
      baseColor = '#f59e0b'; // Amber for SSH
    } else if (port === 53) {
      baseColor = '#8b5cf6'; // Violet for DNS
    } else if (port === 25 || port === 587 || port === 993) {
      baseColor = '#ec4899'; // Pink for email
    } else if (port < 1024) {
      baseColor = '#ef4444'; // Red for system ports
    } else {
      baseColor = '#00ffff'; // Cyan for other ports
    }
    
    // Add intensity based on distance (longer connections are brighter)
    const maxDistance = 20000;
    const intensity = Math.min(distance / maxDistance, 1);
    const alpha = 0.6 + (intensity * 0.4); // 0.6 to 1.0 opacity
    
    // Convert hex to rgba for transparency
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Gets arc stroke width based on traffic data
   * @param {Object} trafficData - Traffic data
   * @returns {number} - Stroke width
   */
  getArcStroke(trafficData) {
    // Thicker strokes for common ports
    const port = trafficData.port;
    
    if (port === 443 || port === 80) {
      return this.config.arcStroke * 1.5;
    } else {
      return this.config.arcStroke;
    }
  }

  /**
   * Generates arc label text with process classification
   * @param {Object} arc - Arc data
   * @returns {string} - Label text
   */
  generateArcLabel(arc) {
    const parts = [];
    
    if (arc.city && arc.country) {
      parts.push(`${arc.city}, ${arc.country}`);
    } else if (arc.country) {
      parts.push(arc.country);
    }
    
    if (arc.ip) {
      parts.push(arc.ip);
    }
    
    if (arc.processName) {
      parts.push(`Process: ${arc.processName}`);
    } else if (arc.process) {
      parts.push(`Process: ${arc.process}`);
    }
    
    if (arc.processType && arc.processType !== 'other') {
      parts.push(`Type: ${arc.processType}`);
    }
    
    if (arc.port) {
      parts.push(`Port: ${arc.port}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Adds a connection point at the destination location
   * @param {Object} trafficData - Traffic data
   */
  addConnectionPoint(trafficData) {
    try {
      if (!this.globe || !trafficData.lat || !trafficData.lon) {
        return;
      }

      // Get current points data
      const currentPoints = this.globe.pointsData() || [];
      
      // Create new point
      const point = {
        lat: trafficData.lat,
        lng: trafficData.lon,
        ip: trafficData.ip,
        city: trafficData.city,
        country: trafficData.country,
        timestamp: Date.now(),
        color: this.getArcColor(trafficData)
      };
      
      // Add point with fade-out after 5 seconds
      currentPoints.push(point);
      this.globe.pointsData(currentPoints);
      
      // Remove point after delay
      setTimeout(() => {
        const updatedPoints = this.globe.pointsData().filter(p => p.timestamp !== point.timestamp);
        this.globe.pointsData(updatedPoints);
      }, 5000);
      
    } catch (error) {
      console.warn('[ArcManager] Could not add connection point:', error);
    }
  }

  /**
   * Adds a connection ring at the destination location
   * @param {Object} trafficData - Traffic data
   */
  addConnectionRing(trafficData) {
    try {
      if (!this.globe || !trafficData.lat || !trafficData.lon) {
        return;
      }

      // Get current rings data
      const currentRings = this.globe.ringsData() || [];
      
      // Create new ring
      const ring = {
        lat: trafficData.lat,
        lng: trafficData.lon,
        maxR: 3,
        propagationSpeed: 2,
        repeatPeriod: 1000,
        timestamp: Date.now(),
        color: this.getArcColor(trafficData)
      };
      
      // Add ring with fade-out after 3 seconds
      currentRings.push(ring);
      this.globe.ringsData(currentRings);
      
      // Remove ring after delay
      setTimeout(() => {
        const updatedRings = this.globe.ringsData().filter(r => r.timestamp !== ring.timestamp);
        this.globe.ringsData(updatedRings);
      }, 3000);
      
    } catch (error) {
      console.warn('[ArcManager] Could not add connection ring:', error);
    }
  }

  /**
   * Starts the animation loop for cleanup and updates
   */
  startAnimationLoop() {
    const animate = () => {
      const now = Date.now();
      
      // Periodic cleanup
      if (now - this.lastCleanup > this.cleanupInterval) {
        this.cleanupArcs();
        this.lastCleanup = now;
      }
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  /**
   * Stops the animation loop
   */
  stopAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Clears all arcs
   */
  clearAllArcs() {
    console.log('[ArcManager] Clearing all arcs');
    
    this.arcs.clear();
    this.arcArray.length = 0;
    this.updateGlobeArcs();
    
    this.stats.currentArcs = 0;
  }

  /**
   * Gets arc by ID
   * @param {string} arcId - Arc ID
   * @returns {Object|null} - Arc data or null
   */
  getArc(arcId) {
    return this.arcs.get(arcId) || null;
  }

  /**
   * Gets all current arcs
   * @returns {Array} - Array of arc data
   */
  getAllArcs() {
    return Array.from(this.arcs.values());
  }

  /**
   * Updates configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.setupGlobeArcs();
    console.log('[ArcManager] Configuration updated');
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
      console.warn(`[ArcManager] Unknown event: ${event}`);
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
          console.error(`[ArcManager] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Gets manager statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      currentArcs: this.arcs.size,
      config: { ...this.config }
    };
  }

  /**
   * Destroys the arc manager and cleans up resources
   */
  destroy() {
    console.log('[ArcManager] Destroying arc manager...');
    
    this.stopAnimationLoop();
    this.clearAllArcs();
    
    // Clear event handlers
    Object.keys(this.eventHandlers).forEach(event => {
      this.eventHandlers[event] = [];
    });
    
    this.globe = null;
    
    console.log('[ArcManager] Arc manager destroyed');
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArcManager;
} else if (typeof window !== 'undefined') {
  window.ArcManager = ArcManager;
}