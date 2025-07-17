const GeolocationService = require('../services/GeolocationService');
const fs = require('fs').promises;
const path = require('path');

// Mock node-fetch and fs
jest.mock('node-fetch');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

const fetch = require('node-fetch');

describe('GeolocationService', () => {
  let geoService;
  let mockResponse;

  beforeEach(async () => {
    geoService = new GeolocationService();

    // Wait for cache loading to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create mock response
    mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn()
    };

    fetch.mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
    geoService.clearCache();
  });

  describe('getLocation', () => {
    test('should fetch and return location data for valid IP', async () => {
      const mockData = {
        status: 'success',
        country: 'United States',
        countryCode: 'US',
        region: 'CA',
        regionName: 'California',
        city: 'Mountain View',
        zip: '94043',
        lat: 37.4056,
        lon: -122.0775,
        timezone: 'America/Los_Angeles',
        isp: 'Google LLC',
        org: 'Google Public DNS',
        as: 'AS15169 Google LLC'
      };

      mockResponse.json.mockResolvedValue(mockData);

      const result = await geoService.getLocation('8.8.8.8');

      expect(fetch).toHaveBeenCalledWith(
        'http://ip-api.com/json/8.8.8.8',
        expect.objectContaining({
          timeout: 10000,
          headers: { 'User-Agent': 'Live-Traffic-Globe/1.0' }
        })
      );

      expect(result).toEqual(expect.objectContaining({
        ip: '8.8.8.8',
        status: 'success',
        country: 'United States',
        city: 'Mountain View',
        lat: 37.4056,
        lon: -122.0775
      }));
    });

    test('should cache successful results', async () => {
      const mockData = {
        status: 'success',
        country: 'United States',
        city: 'Mountain View',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      // First call
      await geoService.getLocation('8.8.8.8');

      // Second call should use cache
      const result = await geoService.getLocation('8.8.8.8');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.ip).toBe('8.8.8.8');
    });

    test('should handle API errors gracefully', async () => {
      mockResponse.ok = false;
      mockResponse.status = 429;
      mockResponse.statusText = 'Too Many Requests';

      const result = await geoService.getLocation('8.8.8.8');

      expect(result).toEqual(expect.objectContaining({
        ip: '8.8.8.8',
        status: 'fail',
        error: expect.stringContaining('HTTP 429')
      }));
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await geoService.getLocation('8.8.8.8');

      expect(result).toEqual(expect.objectContaining({
        ip: '8.8.8.8',
        status: 'fail',
        error: 'Network error'
      }));
    });

    test('should reject invalid IP addresses', async () => {
      await expect(geoService.getLocation('')).rejects.toThrow('Invalid IP address provided');
      await expect(geoService.getLocation(null)).rejects.toThrow('Invalid IP address provided');
      await expect(geoService.getLocation(123)).rejects.toThrow('Invalid IP address provided');
    });
  });

  describe('isValidLocationResponse', () => {
    test('should validate correct response structure', () => {
      const validResponse = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775,
        country: 'United States'
      };

      expect(geoService.isValidLocationResponse(validResponse)).toBe(true);
    });

    test('should reject invalid response structures', () => {
      expect(geoService.isValidLocationResponse(null)).toBe(false);
      expect(geoService.isValidLocationResponse({})).toBe(false);
      expect(geoService.isValidLocationResponse({ status: 'success' })).toBe(false); // Missing lat/lon
      expect(geoService.isValidLocationResponse({ lat: 37.4056, lon: -122.0775 })).toBe(false); // Missing status
    });

    test('should accept fail status without coordinates', () => {
      const failResponse = {
        status: 'fail',
        message: 'Invalid IP'
      };

      expect(geoService.isValidLocationResponse(failResponse)).toBe(true);
    });
  });

  describe('getLocations', () => {
    test('should handle multiple IPs', async () => {
      const mockData = {
        status: 'success',
        country: 'United States',
        city: 'Mountain View',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      const results = await geoService.getLocations(['8.8.8.8', '1.1.1.1']);

      expect(results).toHaveLength(2);
      expect(results[0].ip).toBe('8.8.8.8');
      expect(results[1].ip).toBe('1.1.1.1');
    });

    test('should handle mixed success and failure results', async () => {
      // First call succeeds
      mockResponse.json.mockResolvedValueOnce({
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      });

      // Second call fails
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const results = await geoService.getLocations(['8.8.8.8', '1.1.1.1']);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('fail');
    }, 10000);

    test('should reject non-array input', async () => {
      await expect(geoService.getLocations('8.8.8.8')).rejects.toThrow('IPs must be provided as an array');
    });
  });

  describe('cache management', () => {
    test('should clear cache', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      await geoService.getLocation('8.8.8.8');
      expect(geoService.getCacheStats().size).toBe(1);

      geoService.clearCache();
      expect(geoService.getCacheStats().size).toBe(0);
    });

    test('should provide cache statistics', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      await geoService.getLocation('8.8.8.8');
      const stats = geoService.getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.entries).toContain('8.8.8.8');
    });
  });

  describe('rate limiting', () => {
    test('should set rate limit delay', () => {
      geoService.setRateLimit(500);
      expect(geoService.rateLimitDelay).toBe(500);
    });

    test('should not allow negative rate limit', () => {
      geoService.setRateLimit(-100);
      expect(geoService.rateLimitDelay).toBe(0);
    });
  });

  describe('getStatus', () => {
    test('should return enhanced service status', () => {
      const status = geoService.getStatus();

      expect(status).toEqual(expect.objectContaining({
        cacheSize: 0,
        queueLength: 0,
        activeRequests: 0,
        isProcessingQueue: false,
        rateLimitDelay: 250,
        maxRetries: 3,
        retryBaseDelay: 1000,
        cacheDuration: 24 * 60 * 60 * 1000,
        maxConcurrentRequests: 5,
        cacheFile: '.cache/geolocation.json',
        apiUrl: 'http://ip-api.com/json/',
        lastRequestTime: 0
      }));
    });
  });

  describe('enhanced rate limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should enforce minimum delay between requests', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      const startTime = Date.now();

      // Make first request
      const promise1 = geoService.getLocation('8.8.8.8');

      // Make second request immediately
      const promise2 = geoService.getLocation('1.1.1.1');

      // Fast-forward time to allow processing
      jest.advanceTimersByTime(500);

      await Promise.all([promise1, promise2]);

      // Should have enforced rate limiting delay
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should limit concurrent requests', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      // Create more requests than the concurrent limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(geoService.getLocation(`192.168.1.${i}`));
      }

      // Fast-forward time to allow processing
      jest.advanceTimersByTime(5000);

      await Promise.all(promises);

      // All requests should eventually complete
      expect(fetch).toHaveBeenCalledTimes(10);
    }, 15000);

    test('should implement exponential backoff for retries', async () => {
      // First call fails
      fetch.mockRejectedValueOnce(new Error('Network error'));
      // Second call fails
      fetch.mockRejectedValueOnce(new Error('Network error'));
      // Third call succeeds
      mockResponse.json.mockResolvedValueOnce({
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      });

      const promise = geoService.getLocation('8.8.8.8');

      // Fast-forward through retry delays
      jest.advanceTimersByTime(1000); // First retry after 1s
      jest.advanceTimersByTime(2000); // Second retry after 2s
      jest.advanceTimersByTime(1000); // Allow final request to complete

      const result = await promise;

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('success');
    });

    test('should give up after max retries', async () => {
      // All calls fail
      fetch.mockRejectedValue(new Error('Persistent network error'));

      const promise = geoService.getLocation('8.8.8.8');

      // Fast-forward through all retry attempts
      jest.advanceTimersByTime(10000);

      const result = await promise;

      expect(result.status).toBe('fail');
      expect(result.error).toBe('Persistent network error');
      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('enhanced caching', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      fs.readFile.mockClear();
      fs.writeFile.mockClear();
      fs.mkdir.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should load persistent cache on startup', async () => {
      const cacheData = {
        '8.8.8.8': {
          ip: '8.8.8.8',
          status: 'success',
          city: 'Mountain View',
          lat: 37.4056,
          lon: -122.0775,
          timestamp: Date.now()
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const newService = new GeolocationService();

      // Wait for cache loading with fake timers
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(fs.readFile).toHaveBeenCalledWith('.cache/geolocation.json', 'utf8');
      expect(newService.getCacheStats().size).toBe(1);
    }, 10000);

    test('should handle missing cache file gracefully', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const newService = new GeolocationService();

      // Wait for cache loading attempt with fake timers
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(newService.getCacheStats().size).toBe(0);
    }, 10000);

    test('should expire old cache entries', async () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const cacheData = {
        '8.8.8.8': {
          ip: '8.8.8.8',
          status: 'success',
          city: 'Mountain View',
          lat: 37.4056,
          lon: -122.0775,
          timestamp: oldTimestamp
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const newService = new GeolocationService();

      // Wait for cache loading with fake timers
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(newService.getCacheStats().size).toBe(0); // Expired entry should be filtered out
    }, 10000);

    test('should save cache after successful requests', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await geoService.getLocation('8.8.8.8');

      expect(fs.mkdir).toHaveBeenCalledWith('.cache', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '.cache/geolocation.json',
        expect.stringContaining('8.8.8.8')
      );
    });

    test('should clean up expired cache entries', () => {
      // Add expired entry to cache
      const expiredEntry = {
        ip: '8.8.8.8',
        status: 'success',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      geoService.cache.set('8.8.8.8', expiredEntry);

      const removedCount = geoService.cleanupExpiredCache();

      expect(removedCount).toBe(1);
      expect(geoService.getCacheStats().size).toBe(0);
    });

    test('should not return expired cache entries', async () => {
      // Add expired entry to cache
      const expiredEntry = {
        ip: '8.8.8.8',
        status: 'success',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      geoService.cache.set('8.8.8.8', expiredEntry);

      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      // Should make new API call since cache entry is expired
      await geoService.getLocation('8.8.8.8');

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should manually save persistent cache', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      // Add entry to cache
      geoService.cache.set('8.8.8.8', {
        ip: '8.8.8.8',
        status: 'success',
        timestamp: Date.now()
      });

      await geoService.forceSavePersistentCache();

      expect(fs.writeFile).toHaveBeenCalledWith(
        '.cache/geolocation.json',
        expect.stringContaining('8.8.8.8')
      );
    });
  });

  describe('request queuing system', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should queue requests when processing', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      // Make multiple requests quickly
      const promises = [
        geoService.getLocation('8.8.8.8'),
        geoService.getLocation('1.1.1.1'),
        geoService.getLocation('4.4.4.4')
      ];

      // Check that requests are queued
      expect(geoService.getStatus().queueLength).toBeGreaterThan(0);

      // Fast-forward time to allow processing
      jest.advanceTimersByTime(5000);

      await Promise.all(promises);

      expect(fetch).toHaveBeenCalledTimes(3);
    }, 15000);

    test('should process queue in order', async () => {
      const mockData = {
        status: 'success',
        lat: 37.4056,
        lon: -122.0775
      };

      mockResponse.json.mockResolvedValue(mockData);

      const ips = ['8.8.8.8', '1.1.1.1', '4.4.4.4'];
      const promises = ips.map(ip => geoService.getLocation(ip));

      // Fast-forward time to allow processing
      jest.advanceTimersByTime(5000);

      await Promise.all(promises);

      // Verify calls were made in order
      expect(fetch).toHaveBeenNthCalledWith(1, 'http://ip-api.com/json/8.8.8.8', expect.any(Object));
      expect(fetch).toHaveBeenNthCalledWith(2, 'http://ip-api.com/json/1.1.1.1', expect.any(Object));
      expect(fetch).toHaveBeenNthCalledWith(3, 'http://ip-api.com/json/4.4.4.4', expect.any(Object));
    }, 15000);
  });
});