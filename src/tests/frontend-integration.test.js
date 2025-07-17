/**
 * Frontend Integration Tests
 * Tests end-to-end frontend functionality and component integration
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection after a delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 100);
  }
  
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock successful send
  }
  
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, type: 'close' });
    }
  }
  
  // Mock message sending for testing
  mockMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data), type: 'message' });
    }
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn()
};

// Mock THREE.js objects
const mockTHREE = {
  MeshPhongMaterial: jest.fn(() => ({ bumpScale: 10, shininess: 0.1 })),
  AmbientLight: jest.fn(() => ({ position: { set: jest.fn() } })),
  DirectionalLight: jest.fn(() => ({ position: { set: jest.fn() } })),
  Scene: jest.fn(() => ({ add: jest.fn() }))
};

// Mock Globe.gl
const mockGlobe = jest.fn(() => ({
  globeImageUrl: jest.fn().mockReturnThis(),
  bumpImageUrl: jest.fn().mockReturnThis(),
  backgroundImageUrl: jest.fn().mockReturnThis(),
  showAtmosphere: jest.fn().mockReturnThis(),
  atmosphereColor: jest.fn().mockReturnThis(),
  atmosphereAltitude: jest.fn().mockReturnThis(),
  globeMaterial: jest.fn().mockReturnThis(),
  enablePointerInteraction: jest.fn().mockReturnThis(),
  arcsData: jest.fn().mockReturnThis(),
  arcColor: jest.fn().mockReturnThis(),
  arcStroke: jest.fn().mockReturnThis(),
  arcDashLength: jest.fn().mockReturnThis(),
  arcDashGap: jest.fn().mockReturnThis(),
  arcDashAnimateTime: jest.fn().mockReturnThis(),
  arcStartLat: jest.fn().mockReturnThis(),
  arcStartLng: jest.fn().mockReturnThis(),
  arcEndLat: jest.fn().mockReturnThis(),
  arcEndLng: jest.fn().mockReturnThis(),
  arcAltitude: jest.fn().mockReturnThis(),
  arcAltitudeAutoScale: jest.fn().mockReturnThis(),
  arcLabel: jest.fn().mockReturnThis(),
  onArcClick: jest.fn().mockReturnThis(),
  onArcHover: jest.fn().mockReturnThis(),
  onGlobeClick: jest.fn().mockReturnThis(),
  onGlobeHover: jest.fn().mockReturnThis(),
  pointOfView: jest.fn().mockReturnThis(),
  controls: jest.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.1,
    enableZoom: true,
    enableRotate: true,
    enablePan: false,
    minDistance: 101,
    maxDistance: 1000,
    autoRotate: false,
    autoRotateSpeed: 0.5
  })),
  scene: jest.fn(() => mockTHREE.Scene()),
  camera: jest.fn(() => ({})),
  renderer: jest.fn(() => ({}))
}));

describe('Frontend Integration Tests', () => {
  let mockWindow;
  let mockDocument;
  let components;

  beforeEach(() => {
    // Create a simplified mock environment
    mockDocument = {
      getElementById: jest.fn((id) => {
        if (id === 'globe-container' || id === 'status-display') {
          return {
            innerHTML: '',
            style: { display: 'block' },
            appendChild: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => []),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            clientWidth: 800,
            clientHeight: 600,
            getBoundingClientRect: () => ({ width: 800, height: 600 })
          };
        }
        return null;
      }),
      createElement: jest.fn(() => ({
        style: {},
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() }
      })),
      head: { insertAdjacentHTML: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    mockWindow = {
      WebSocket: MockWebSocket,
      THREE: mockTHREE,
      Globe: mockGlobe,
      navigator: {
        geolocation: mockGeolocation,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      requestAnimationFrame: jest.fn(cb => setTimeout(cb, 16)),
      cancelAnimationFrame: jest.fn(),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'America/New_York' }) }) },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { reload: jest.fn() },
      open: jest.fn()
    };

    // Load components with mocked environment
    components = loadComponentsWithMocks(mockWindow, mockDocument);
  });

  function loadComponentsWithMocks(window, document) {
    const componentPaths = [
      '../../src/frontend/WebSocketClient.js',
      '../../src/frontend/LocationService.js',
      '../../src/frontend/GlobeRenderer.js',
      '../../src/frontend/ArcManager.js',
      '../../src/frontend/StatusDisplay.js'
    ];
    
    const loadedComponents = {};
    
    for (const componentPath of componentPaths) {
      const fullPath = path.join(__dirname, componentPath);
      const componentCode = fs.readFileSync(fullPath, 'utf8');
      
      // Create isolated execution context
      const context = { window, document, console: window.console };
      const executeInContext = new Function('window', 'document', 'console', componentCode);
      executeInContext(window, document, window.console);
    }
    
    return {
      WebSocketClient: window.WebSocketClient,
      LocationService: window.LocationService,
      GlobeRenderer: window.GlobeRenderer,
      ArcManager: window.ArcManager,
      StatusDisplay: window.StatusDisplay
    };
  }

  describe('Component Loading', () => {
    test('should load all required frontend components', () => {
      expect(components.WebSocketClient).toBeDefined();
      expect(components.LocationService).toBeDefined();
      expect(components.GlobeRenderer).toBeDefined();
      expect(components.ArcManager).toBeDefined();
      expect(components.StatusDisplay).toBeDefined();
    });

    test('should have all required DOM elements', () => {
      expect(mockDocument.getElementById('globe-container')).toBeTruthy();
      expect(mockDocument.getElementById('status-display')).toBeTruthy();
    });
  });

  describe('WebSocket Integration', () => {
    test('should create WebSocket client with correct URL', () => {
      const client = new components.WebSocketClient('ws://localhost:8080');
      expect(client.url).toBe('ws://localhost:8080');
      expect(client.isConnected).toBe(false);
    });

    test('should handle WebSocket connection events', (done) => {
      const client = new components.WebSocketClient('ws://localhost:8080');
      
      client.on('open', () => {
        expect(client.isConnected).toBe(true);
        done();
      });
      
      client.connect();
    });

    test('should handle traffic data messages', (done) => {
      const client = new components.WebSocketClient('ws://localhost:8080');
      const mockTrafficData = {
        type: 'traffic',
        data: {
          ip: '8.8.8.8',
          lat: 37.7749,
          lon: -122.4194,
          city: 'San Francisco',
          country: 'United States',
          timestamp: Date.now()
        }
      };
      
      client.on('traffic', (data) => {
        expect(data.data.ip).toBe('8.8.8.8');
        expect(data.data.city).toBe('San Francisco');
        done();
      });
      
      client.connect();
      
      setTimeout(() => {
        client.ws.mockMessage(mockTrafficData);
      }, 150);
    });
  });

  describe('Location Service Integration', () => {
    test('should create location service', () => {
      const locationService = new components.LocationService();
      expect(locationService).toBeDefined();
      expect(locationService.currentLocation).toBeNull();
    });

    test('should handle successful geolocation', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10
        },
        timestamp: Date.now()
      };
      
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        setTimeout(() => success(mockPosition), 100);
      });
      
      const locationService = new components.LocationService();
      const location = await locationService.getCurrentLocation();
      
      expect(location.lat).toBe(37.7749);
      expect(location.lon).toBe(-122.4194);
      expect(location.source).toBe('geolocation');
    });

    test('should handle geolocation permission denied', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied geolocation'
      };
      
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        setTimeout(() => error(mockError), 100);
      });
      
      const locationService = new components.LocationService();
      const location = await locationService.getCurrentLocation();
      
      expect(location.source).toBe('fallback');
      expect(location.lat).toBeDefined();
      expect(location.lon).toBeDefined();
    });
  });

  describe('Globe Renderer Integration', () => {
    test('should create globe renderer', () => {
      const renderer = new components.GlobeRenderer('globe-container');
      expect(renderer).toBeDefined();
      expect(renderer.containerId).toBe('globe-container');
      expect(renderer.isInitialized).toBe(false);
    });

    test('should initialize globe with configuration', async () => {
      const renderer = new components.GlobeRenderer('globe-container', {
        pointOfView: { lat: 37.7749, lng: -122.4194, altitude: 2.5 }
      });
      
      await renderer.initialize();
      
      expect(renderer.isInitialized).toBe(true);
      expect(renderer.globe).toBeDefined();
      expect(mockGlobe).toHaveBeenCalled();
    });

    test('should handle missing container error', async () => {
      const renderer = new components.GlobeRenderer('non-existent-container');
      
      await expect(renderer.initialize()).rejects.toThrow(
        "Container element with ID 'non-existent-container' not found"
      );
    });
  });

  describe('Arc Manager Integration', () => {
    test('should create arc manager with globe instance', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance);
      
      expect(arcManager).toBeDefined();
      expect(arcManager.globe).toBe(mockGlobeInstance);
      expect(arcManager.arcs.size).toBe(0);
    });

    test('should add traffic arc', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance);
      
      const trafficData = {
        ip: '8.8.8.8',
        lat: 37.7749,
        lon: -122.4194,
        city: 'San Francisco',
        country: 'United States',
        port: 443,
        timestamp: Date.now()
      };
      
      const userLocation = {
        lat: 40.7128,
        lon: -74.0060
      };
      
      const arc = arcManager.addArc(trafficData, userLocation);
      
      expect(arc).toBeDefined();
      expect(arc.ip).toBe('8.8.8.8');
      expect(arc.startLat).toBe(40.7128);
      expect(arc.endLat).toBe(37.7749);
      expect(arcManager.arcs.size).toBe(1);
    });

    test('should remove old arcs when exceeding max count', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance, { maxArcs: 2 });
      
      const userLocation = { lat: 40.7128, lon: -74.0060 };
      
      // Add 3 arcs (exceeds max of 2)
      for (let i = 0; i < 3; i++) {
        arcManager.addArc({
          ip: `8.8.8.${i}`,
          lat: 37.7749 + i,
          lon: -122.4194 + i,
          city: `City${i}`,
          country: 'Test',
          port: 443,
          timestamp: Date.now() + i
        }, userLocation);
      }
      
      // Trigger cleanup
      arcManager.cleanupArcs();
      
      expect(arcManager.arcs.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Status Display Integration', () => {
    test('should create status display', () => {
      const statusDisplay = new components.StatusDisplay('status-display');
      expect(statusDisplay).toBeDefined();
      expect(statusDisplay.containerId).toBe('status-display');
    });

    test('should update connection status', () => {
      const statusDisplay = new components.StatusDisplay('status-display');
      statusDisplay.updateConnectionStatus('connected');
      
      const statusElement = mockDocument.querySelector('#connection-status');
      expect(statusElement).toBeDefined();
    });

    test('should add traffic events', () => {
      const statusDisplay = new components.StatusDisplay('status-display');
      
      const trafficData = {
        ip: '8.8.8.8',
        city: 'San Francisco',
        country: 'United States',
        process: 'Chrome',
        port: 443
      };
      
      expect(() => statusDisplay.addTrafficEvent(trafficData)).not.toThrow();
    });

    test('should handle invalid traffic data gracefully', () => {
      const statusDisplay = new components.StatusDisplay('status-display');
      
      // Test with null data
      expect(() => statusDisplay.addTrafficEvent(null)).not.toThrow();
      
      // Test with empty object
      expect(() => statusDisplay.addTrafficEvent({})).not.toThrow();
      
      // Test with invalid data type
      expect(() => statusDisplay.addTrafficEvent('invalid')).not.toThrow();
    });
  });

  describe('End-to-End Data Flow', () => {
    test('should handle complete data flow from WebSocket to visualization', (done) => {
      const mockGlobeInstance = mockGlobe();
      
      // Create components
      const webSocketClient = new components.WebSocketClient('ws://localhost:8080');
      const arcManager = new components.ArcManager(mockGlobeInstance);
      const statusDisplay = new components.StatusDisplay('status-display');
      
      const userLocation = { lat: 40.7128, lon: -74.0060 };
      
      // Set up data flow
      webSocketClient.on('traffic', (data) => {
        const trafficData = data.data;
        
        // Add arc
        const arc = arcManager.addArc(trafficData, userLocation);
        expect(arc).toBeDefined();
        
        // Update status
        statusDisplay.addTrafficEvent(trafficData);
        
        // Verify arc was added
        expect(arcManager.arcs.size).toBe(1);
        
        // Verify status was updated
        const lastTrafficElement = document.querySelector('#last-traffic');
        expect(lastTrafficElement.textContent).toContain('8.8.8.8');
        
        done();
      });
      
      // Connect and send mock data
      webSocketClient.connect();
      
      setTimeout(() => {
        webSocketClient.ws.mockMessage({
          type: 'traffic',
          data: {
            ip: '8.8.8.8',
            lat: 37.7749,
            lon: -122.4194,
            city: 'San Francisco',
            country: 'United States',
            port: 443,
            timestamp: Date.now()
          }
        });
      }, 150);
    });

    test('should handle WebSocket reconnection', (done) => {
      const client = new components.WebSocketClient('ws://localhost:8080');
      let reconnectCount = 0;
      
      client.on('reconnecting', () => {
        reconnectCount++;
      });
      
      client.on('open', () => {
        if (reconnectCount === 0) {
          // First connection - simulate disconnect
          client.ws.close(1006, 'Connection lost');
        } else {
          // Reconnected successfully
          expect(reconnectCount).toBeGreaterThan(0);
          done();
        }
      });
      
      client.connect();
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket connection errors', (done) => {
      const client = new components.WebSocketClient('ws://invalid-url');
      
      client.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      // Mock connection error
      setTimeout(() => {
        if (client.ws && client.ws.onerror) {
          client.ws.onerror(new Error('Connection failed'));
        }
      }, 100);
      
      client.connect();
    });

    test('should handle globe initialization errors', async () => {
      // Mock Globe to throw error
      mockWindow.Globe = jest.fn(() => {
        throw new Error('WebGL not supported');
      });
      
      const renderer = new components.GlobeRenderer('globe-container');
      
      await expect(renderer.initialize()).rejects.toThrow('WebGL not supported');
    });

    test('should handle invalid arc data', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance);
      
      // Test with null data
      const result = arcManager.addArc(null, { lat: 0, lon: 0 });
      expect(result).toBeNull();
      
      // Test with missing location
      const result2 = arcManager.addArc({ ip: '8.8.8.8' }, null);
      expect(result2).toBeNull();
    });
  });

  describe('Performance and Cleanup', () => {
    test('should clean up resources on destroy', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance);
      
      // Add some arcs
      const userLocation = { lat: 40.7128, lon: -74.0060 };
      arcManager.addArc({
        ip: '8.8.8.8',
        lat: 37.7749,
        lon: -122.4194,
        city: 'Test',
        country: 'Test'
      }, userLocation);
      
      expect(arcManager.arcs.size).toBe(1);
      
      // Destroy and verify cleanup
      arcManager.destroy();
      expect(arcManager.arcs.size).toBe(0);
      expect(arcManager.globe).toBeNull();
    });

    test('should handle high frequency traffic data', () => {
      const mockGlobeInstance = mockGlobe();
      const arcManager = new components.ArcManager(mockGlobeInstance, { maxArcs: 10 });
      const userLocation = { lat: 40.7128, lon: -74.0060 };
      
      // Add many arcs quickly
      for (let i = 0; i < 20; i++) {
        arcManager.addArc({
          ip: `192.168.1.${i}`,
          lat: 37.7749 + (i * 0.01),
          lon: -122.4194 + (i * 0.01),
          city: `City${i}`,
          country: 'Test',
          port: 443,
          timestamp: Date.now() + i
        }, userLocation);
      }
      
      // Should not exceed max arcs after cleanup
      arcManager.cleanupArcs();
      expect(arcManager.arcs.size).toBeLessThanOrEqual(10);
    });
  });
});