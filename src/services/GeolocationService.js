const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const CONFIG = require('../config');

/**
 * GeolocationService class for IP-to-coordinates conversion
 * Handles HTTP requests to geolocation APIs with enhanced rate limiting and caching
 */
class GeolocationService {
  constructor() {
    this.apiUrl = CONFIG.GEOLOCATION_API_URL;
    this.cache = new Map();
    this.requestQueue = [];
    this.activeRequests = new Set();
    this.isProcessingQueue = false;
    this.rateLimitDelay = CONFIG.GEOLOCATION_RATE_LIMIT_DELAY;
    this.maxRetries = CONFIG.GEOLOCATION_MAX_RETRIES;
    this.retryBaseDelay = CONFIG.GEOLOCATION_RETRY_BASE_DELAY;
    this.cacheDuration = CONFIG.GEOLOCATION_CACHE_DURATION;
    this.cacheFile = CONFIG.GEOLOCATION_CACHE_FILE;
    this.maxConcurrentRequests = CONFIG.GEOLOCATION_MAX_CONCURRENT_REQUESTS;
    this.lastRequestTime = 0;
    this.cacheLoaded = false;
    
    // Load persistent cache on startup (non-blocking)
    this.loadPersistentCache().catch(err => {
      console.warn(`[GeolocationService] Failed to load cache: ${err.message}`);
    });
  }

  /**
   * Loads persistent cache from disk
   */
  async loadPersistentCache() {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cacheData = JSON.parse(data);
      
      // Load cache entries and validate expiration
      const now = Date.now();
      let loadedCount = 0;
      let expiredCount = 0;
      
      for (const [ip, entry] of Object.entries(cacheData)) {
        if (entry.timestamp && (now - entry.timestamp) <= this.cacheDuration) {
          this.cache.set(ip, entry);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }
      
      console.log(`[GeolocationService] Loaded ${loadedCount} cached entries, expired ${expiredCount} entries`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[GeolocationService] Failed to load persistent cache: ${error.message}`);
      }
    }
  }

  /**
   * Saves persistent cache to disk
   */
  async savePersistentCache() {
    try {
      // Convert Map to Object for JSON serialization
      const cacheData = {};
      for (const [ip, entry] of this.cache.entries()) {
        cacheData[ip] = entry;
      }
      
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`[GeolocationService] Saved ${this.cache.size} entries to persistent cache`);
    } catch (error) {
      console.error(`[GeolocationService] Failed to save persistent cache: ${error.message}`);
    }
  }

  /**
   * Gets geolocation data for an IP address
   * @param {string} ip - IP address to geolocate
   * @returns {Promise<Object>} - Geolocation data or null if failed
   */
  async getLocation(ip) {
    if (!ip || typeof ip !== 'string') {
      throw new Error('Invalid IP address provided');
    }

    // Check cache first (including expiration check)
    const cachedResult = this.getCachedResult(ip);
    if (cachedResult) {
      return cachedResult;
    }

    // Add to queue and process
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        ip,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  /**
   * Gets cached result if valid and not expired
   * @param {string} ip - IP address to check
   * @returns {Object|null} - Cached result or null if not found/expired
   */
  getCachedResult(ip) {
    if (!this.cache.has(ip)) {
      return null;
    }

    const cached = this.cache.get(ip);
    const now = Date.now();
    
    // Check if cache entry has expired
    if (cached.timestamp && (now - cached.timestamp) > this.cacheDuration) {
      this.cache.delete(ip);
      return null;
    }

    return cached;
  }

  /**
   * Processes the request queue with enhanced rate limiting and concurrent request management
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      
      // Ensure rate limiting delay has passed
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        const delayNeeded = this.rateLimitDelay - timeSinceLastRequest;
        await this.delay(delayNeeded);
      }

      // Process request asynchronously
      this.processRequest(request);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Processes a single request with retry logic and exponential backoff
   * @param {Object} request - Request object with ip, resolve, reject, retries
   */
  async processRequest(request) {
    this.activeRequests.add(request.ip);
    this.lastRequestTime = Date.now();

    try {
      const result = await this.fetchLocationData(request.ip);
      
      // Cache successful results with timestamp
      if (result && result.status === 'success') {
        result.timestamp = Date.now();
        this.cache.set(request.ip, result);
        
        // Save to persistent cache periodically
        this.savePersistentCache();
      }
      
      request.resolve(result);
    } catch (error) {
      // Implement exponential backoff for retries
      if (request.retries < this.maxRetries) {
        request.retries++;
        const backoffDelay = this.retryBaseDelay * Math.pow(2, request.retries - 1);
        
        console.log(`[GeolocationService] Retrying ${request.ip} (attempt ${request.retries}/${this.maxRetries}) after ${backoffDelay}ms`);
        
        // Add back to queue with exponential backoff delay
        setTimeout(() => {
          this.requestQueue.push(request);
          this.processQueue();
        }, backoffDelay);
      } else {
        console.error(`[GeolocationService] Failed to geolocate ${request.ip} after ${this.maxRetries} attempts:`, error.message);
        
        // Return a failed response object instead of rejecting
        const failedResult = {
          ip: request.ip,
          status: 'fail',
          country: 'Unknown',
          countryCode: 'XX',
          city: 'Unknown',
          lat: 0,
          lon: 0,
          error: error.message,
          timestamp: Date.now()
        };
        
        request.resolve(failedResult);
      }
    } finally {
      this.activeRequests.delete(request.ip);
      
      // Continue processing queue if there are more requests
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processQueue(), this.rateLimitDelay);
      }
    }
  }

  /**
   * Fetches location data from the geolocation API
   * @param {string} ip - IP address to lookup
   * @returns {Promise<Object>} - API response data
   */
  async fetchLocationData(ip) {
    const url = `${this.apiUrl}${ip}`;
    
    try {
      console.log(`[GeolocationService] Fetching location for ${ip}`);
      
      const response = await fetch(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Live-Traffic-Globe/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!this.isValidLocationResponse(data)) {
        throw new Error('Invalid response format from geolocation API');
      }

      console.log(`[GeolocationService] Located ${ip}: ${data.city}, ${data.country}`);
      
      return {
        ip: ip,
        status: data.status,
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        region: data.region || '',
        regionName: data.regionName || '',
        city: data.city || 'Unknown',
        zip: data.zip || '',
        lat: parseFloat(data.lat) || 0,
        lon: parseFloat(data.lon) || 0,
        timezone: data.timezone || '',
        isp: data.isp || '',
        org: data.org || '',
        as: data.as || '',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error(`[GeolocationService] Error fetching location for ${ip}:`, error.message);
      
      // Throw error to trigger retry logic
      throw error;
    }
  }

  /**
   * Validates the structure of a geolocation API response
   * @param {Object} data - Response data to validate
   * @returns {boolean} - True if valid response structure
   */
  isValidLocationResponse(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for required fields
    const requiredFields = ['status'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return false;
      }
    }

    // If status is success, check for coordinate fields
    if (data.status === 'success') {
      if (typeof data.lat !== 'number' && typeof data.lat !== 'string') {
        return false;
      }
      if (typeof data.lon !== 'number' && typeof data.lon !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets multiple locations in batch
   * @param {string[]} ips - Array of IP addresses
   * @returns {Promise<Object[]>} - Array of geolocation results
   */
  async getLocations(ips) {
    if (!Array.isArray(ips)) {
      throw new Error('IPs must be provided as an array');
    }

    const promises = ips.map(ip => this.getLocation(ip));
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`[GeolocationService] Failed to geolocate ${ips[index]}:`, result.reason.message);
        return {
          ip: ips[index],
          status: 'fail',
          error: result.reason.message,
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * Clears the location cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[GeolocationService] Cache cleared');
  }

  /**
   * Gets cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Sets rate limiting parameters
   * @param {number} delay - Delay between requests in milliseconds
   */
  setRateLimit(delay) {
    this.rateLimitDelay = Math.max(0, delay);
    console.log(`[GeolocationService] Rate limit set to ${this.rateLimitDelay}ms`);
  }

  /**
   * Utility function to create a delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleans up expired cache entries
   * @returns {number} - Number of entries removed
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [ip, entry] of this.cache.entries()) {
      if (entry.timestamp && (now - entry.timestamp) > this.cacheDuration) {
        this.cache.delete(ip);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[GeolocationService] Cleaned up ${removedCount} expired cache entries`);
    }
    
    return removedCount;
  }

  /**
   * Manually saves the persistent cache
   * @returns {Promise<void>}
   */
  async forceSavePersistentCache() {
    await this.savePersistentCache();
  }

  /**
   * Gets service status and statistics
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      cacheSize: this.cache.size,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      isProcessingQueue: this.isProcessingQueue,
      rateLimitDelay: this.rateLimitDelay,
      maxRetries: this.maxRetries,
      retryBaseDelay: this.retryBaseDelay,
      cacheDuration: this.cacheDuration,
      maxConcurrentRequests: this.maxConcurrentRequests,
      cacheFile: this.cacheFile,
      apiUrl: this.apiUrl,
      lastRequestTime: this.lastRequestTime
    };
  }
}

module.exports = GeolocationService;