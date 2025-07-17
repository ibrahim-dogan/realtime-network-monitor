/**
 * LocationService to acquire user's geographic coordinates
 * Handles geolocation permission requests and provides fallback strategies
 */
class LocationService {
  constructor() {
    this.currentLocation = null;
    this.isAcquiring = false;
    this.hasPermission = null;
    this.watchId = null;
    
    // Default fallback locations for major regions
    this.fallbackLocations = {
      'US': { lat: 39.8283, lon: -98.5795, name: 'United States' },
      'CA': { lat: 56.1304, lon: -106.3468, name: 'Canada' },
      'GB': { lat: 55.3781, lon: -3.4360, name: 'United Kingdom' },
      'DE': { lat: 51.1657, lon: 10.4515, name: 'Germany' },
      'FR': { lat: 46.2276, lon: 2.2137, name: 'France' },
      'JP': { lat: 36.2048, lon: 138.2529, name: 'Japan' },
      'AU': { lat: -25.2744, lon: 133.7751, name: 'Australia' },
      'BR': { lat: -14.2350, lon: -51.9253, name: 'Brazil' },
      'IN': { lat: 20.5937, lon: 78.9629, name: 'India' },
      'CN': { lat: 35.8617, lon: 104.1954, name: 'China' },
      'default': { lat: 40.7128, lon: -74.0060, name: 'New York, USA' }
    };
    
    // Event handlers
    this.eventHandlers = {
      locationAcquired: [],
      locationError: [],
      permissionDenied: [],
      locationChanged: []
    };
  }

  /**
   * Gets the user's current location
   * @param {Object} options - Geolocation options
   * @returns {Promise<Object>} - Location data
   */
  async getCurrentLocation(options = {}) {
    if (this.isAcquiring) {
      console.log('[LocationService] Location acquisition already in progress');
      return this.currentLocation;
    }

    if (!this.isGeolocationSupported()) {
      console.warn('[LocationService] Geolocation not supported by browser');
      return this.getFallbackLocation();
    }

    this.isAcquiring = true;

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    };

    const geoOptions = { ...defaultOptions, ...options };

    try {
      console.log('[LocationService] Requesting user location...');
      
      const position = await this.requestGeolocation(geoOptions);
      
      this.currentLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        source: 'geolocation',
        name: 'Your Location'
      };

      console.log(`[LocationService] Location acquired: ${this.currentLocation.lat.toFixed(4)}, ${this.currentLocation.lon.toFixed(4)}`);
      
      this.hasPermission = true;
      this.emit('locationAcquired', this.currentLocation);
      
      return this.currentLocation;

    } catch (error) {
      console.error('[LocationService] Failed to get location:', error.message);
      
      this.handleLocationError(error);
      
      // Return fallback location
      const fallback = this.getFallbackLocation();
      this.currentLocation = fallback;
      
      return fallback;
      
    } finally {
      this.isAcquiring = false;
    }
  }

  /**
   * Requests geolocation using the browser API
   * @param {Object} options - Geolocation options
   * @returns {Promise<Position>} - Geolocation position
   */
  requestGeolocation(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        options
      );
    });
  }

  /**
   * Starts watching the user's location for changes
   * @param {Object} options - Geolocation options
   */
  startWatching(options = {}) {
    if (!this.isGeolocationSupported()) {
      console.warn('[LocationService] Cannot watch location: geolocation not supported');
      return;
    }

    if (this.watchId !== null) {
      console.log('[LocationService] Already watching location');
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000 // 1 minute
    };

    const geoOptions = { ...defaultOptions, ...options };

    console.log('[LocationService] Starting location watch...');

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'geolocation',
          name: 'Your Location'
        };

        // Check if location has changed significantly
        if (this.hasLocationChanged(newLocation)) {
          console.log('[LocationService] Location changed');
          this.currentLocation = newLocation;
          this.emit('locationChanged', newLocation);
        }
      },
      (error) => {
        console.error('[LocationService] Watch position error:', error.message);
        this.handleLocationError(error);
      },
      geoOptions
    );
  }

  /**
   * Stops watching the user's location
   */
  stopWatching() {
    if (this.watchId !== null) {
      console.log('[LocationService] Stopping location watch');
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Checks if the location has changed significantly
   * @param {Object} newLocation - New location data
   * @returns {boolean} - True if location changed significantly
   */
  hasLocationChanged(newLocation) {
    if (!this.currentLocation) {
      return true;
    }

    const latDiff = Math.abs(newLocation.lat - this.currentLocation.lat);
    const lonDiff = Math.abs(newLocation.lon - this.currentLocation.lon);
    
    // Consider significant if moved more than ~1km (0.01 degrees ≈ 1.1km)
    return latDiff > 0.01 || lonDiff > 0.01;
  }

  /**
   * Handles geolocation errors
   * @param {GeolocationPositionError} error - Geolocation error
   */
  handleLocationError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.warn('[LocationService] User denied location permission');
        this.hasPermission = false;
        this.emit('permissionDenied', error);
        break;
        
      case error.POSITION_UNAVAILABLE:
        console.warn('[LocationService] Location information unavailable');
        this.emit('locationError', error);
        break;
        
      case error.TIMEOUT:
        console.warn('[LocationService] Location request timed out');
        this.emit('locationError', error);
        break;
        
      default:
        console.error('[LocationService] Unknown geolocation error:', error);
        this.emit('locationError', error);
        break;
    }
  }

  /**
   * Gets a fallback location based on user's timezone or default
   * @returns {Object} - Fallback location data
   */
  getFallbackLocation() {
    console.log('[LocationService] Using fallback location');
    
    // Try to determine location from timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fallback = this.getFallbackFromTimezone(timezone);
    
    return {
      ...fallback,
      source: 'fallback',
      accuracy: null,
      timestamp: Date.now()
    };
  }

  /**
   * Gets fallback location based on timezone
   * @param {string} timezone - User's timezone
   * @returns {Object} - Location data
   */
  getFallbackFromTimezone(timezone) {
    if (!timezone) {
      return this.fallbackLocations.default;
    }

    // Map common timezones to countries
    const timezoneMap = {
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'Europe/London': 'GB',
      'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR',
      'Asia/Tokyo': 'JP',
      'Australia/Sydney': 'AU',
      'America/Sao_Paulo': 'BR',
      'Asia/Kolkata': 'IN',
      'Asia/Shanghai': 'CN'
    };

    const countryCode = timezoneMap[timezone];
    if (countryCode && this.fallbackLocations[countryCode]) {
      console.log(`[LocationService] Using fallback for ${countryCode} based on timezone ${timezone}`);
      return this.fallbackLocations[countryCode];
    }

    // Try to match by continent
    if (timezone.startsWith('America/')) {
      return this.fallbackLocations.US;
    } else if (timezone.startsWith('Europe/')) {
      return this.fallbackLocations.GB;
    } else if (timezone.startsWith('Asia/')) {
      return this.fallbackLocations.JP;
    } else if (timezone.startsWith('Australia/')) {
      return this.fallbackLocations.AU;
    }

    return this.fallbackLocations.default;
  }

  /**
   * Checks if geolocation is supported by the browser
   * @returns {boolean} - True if geolocation is supported
   */
  isGeolocationSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Gets the current location without requesting new data
   * @returns {Object|null} - Current location or null
   */
  getLastKnownLocation() {
    return this.currentLocation;
  }

  /**
   * Checks permission status for geolocation
   * @returns {Promise<string>} - Permission status
   */
  async checkPermission() {
    if (!navigator.permissions) {
      return 'unknown';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      this.hasPermission = result.state === 'granted';
      return result.state;
    } catch (error) {
      console.warn('[LocationService] Could not check permission:', error);
      return 'unknown';
    }
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
      console.warn(`[LocationService] Unknown event: ${event}`);
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
          console.error(`[LocationService] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Gets service status
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      isSupported: this.isGeolocationSupported(),
      hasPermission: this.hasPermission,
      isAcquiring: this.isAcquiring,
      isWatching: this.watchId !== null,
      currentLocation: this.currentLocation,
      lastUpdate: this.currentLocation ? this.currentLocation.timestamp : null
    };
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocationService;
} else if (typeof window !== 'undefined') {
  window.LocationService = LocationService;
}