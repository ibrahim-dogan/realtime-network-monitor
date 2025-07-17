/**
 * Unit tests for StatusDisplay component
 * Tests UI state management and user interface functionality
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

// Set up DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body>
      <div id="status-container"></div>
    </body>
  </html>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.navigator = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  geolocation: {
    getCurrentPosition: jest.fn()
  }
};

// Mock canvas for WebGL testing
if (global.HTMLCanvasElement) {
  global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    createShader: jest.fn(),
    shaderSource: jest.fn(),
    compileShader: jest.fn()
  }));
}

// Import StatusDisplay after setting up DOM
const StatusDisplay = require('../frontend/StatusDisplay');

describe('StatusDisplay', () => {
  let statusDisplay;
  let container;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="status-container"></div>';
    container = document.getElementById('status-container');
    
    // Create new StatusDisplay instance
    statusDisplay = new StatusDisplay('status-container', {
      theme: 'dark',
      position: 'top-left',
      autoHide: false
    });
  });

  afterEach(() => {
    if (statusDisplay) {
      statusDisplay.destroy();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with default configuration', () => {
      const display = new StatusDisplay('status-container');
      
      expect(display.config.theme).toBe('dark');
      expect(display.config.position).toBe('top-left');
      expect(display.config.updateInterval).toBe(1000);
      expect(display.isVisible).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        theme: 'light',
        position: 'bottom-right',
        autoHide: true,
        autoHideDelay: 3000
      };
      
      const display = new StatusDisplay('status-container', customConfig);
      
      expect(display.config.theme).toBe('light');
      expect(display.config.position).toBe('bottom-right');
      expect(display.config.autoHide).toBe(true);
      expect(display.config.autoHideDelay).toBe(3000);
      
      display.destroy();
    });

    test('should handle missing container element', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const display = new StatusDisplay('non-existent-container');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Container element with ID \'non-existent-container\' not found')
      );
      
      consoleSpy.mockRestore();
    });

    test('should create UI structure', () => {
      expect(container.querySelector('.status-panel')).toBeTruthy();
      expect(container.querySelector('.status-header')).toBeTruthy();
      expect(container.querySelector('.status-main')).toBeTruthy();
      expect(container.querySelector('#connection-status')).toBeTruthy();
      expect(container.querySelector('#location-status')).toBeTruthy();
      expect(container.querySelector('#last-traffic')).toBeTruthy();
    });

    test('should apply theme styles', () => {
      const styles = document.getElementById('status-display-styles');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('rgba(0, 0, 0, 0.85)'); // Dark theme background
    });
  });

  describe('connection status updates', () => {
    test('should update connection status to connected', () => {
      statusDisplay.updateConnectionStatus('connected');
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('🟢 Connected');
      expect(statusElement.className).toContain('connected');
    });

    test('should update connection status to connecting', () => {
      statusDisplay.updateConnectionStatus('connecting');
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('🟡 Connecting...');
      expect(statusElement.className).toContain('connecting');
    });

    test('should update connection status to disconnected', () => {
      statusDisplay.updateConnectionStatus('disconnected');
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('🔴 Disconnected');
      expect(statusElement.className).toContain('disconnected');
    });

    test('should update connection status to error', () => {
      statusDisplay.updateConnectionStatus('error');
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('❌ Error');
      expect(statusElement.className).toContain('error');
    });

    test('should handle custom status messages', () => {
      statusDisplay.updateConnectionStatus('custom', 'Custom Status Message');
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('Custom Status Message');
    });
  });

  describe('location status updates', () => {
    test('should update location with coordinates', () => {
      const location = {
        lat: 37.7749,
        lon: -122.4194,
        name: 'San Francisco, CA'
      };
      
      statusDisplay.updateLocationStatus(location);
      
      const locationElement = container.querySelector('#location-status');
      expect(locationElement.textContent).toBe('San Francisco, CA');
    });

    test('should update location with coordinates only', () => {
      const location = {
        lat: 37.7749,
        lon: -122.4194
      };
      
      statusDisplay.updateLocationStatus(location);
      
      const locationElement = container.querySelector('#location-status');
      expect(locationElement.textContent).toBe('37.77, -122.42');
    });

    test('should handle null location', () => {
      statusDisplay.updateLocationStatus(null);
      
      const locationElement = container.querySelector('#location-status');
      expect(locationElement.textContent).toBe('Unknown');
    });
  });

  describe('statistics updates', () => {
    test('should update statistics', () => {
      const stats = {
        currentArcs: 5,
        connectionsProcessed: 42,
        errors: 2,
        uptime: 65000 // 1 minute 5 seconds
      };
      
      statusDisplay.updateStats(stats);
      
      expect(container.querySelector('#active-arcs').textContent).toBe('5');
      expect(container.querySelector('#total-connections').textContent).toBe('42');
      expect(container.querySelector('#error-count').textContent).toBe('2');
      expect(container.querySelector('#uptime').textContent).toBe('1m 5s');
    });

    test('should handle missing stats', () => {
      statusDisplay.updateStats(null);
      
      expect(container.querySelector('#active-arcs').textContent).toBe('0');
      expect(container.querySelector('#total-connections').textContent).toBe('0');
      expect(container.querySelector('#error-count').textContent).toBe('0');
    });

    test('should format uptime correctly', () => {
      expect(statusDisplay.formatUptime(5000)).toBe('5s');
      expect(statusDisplay.formatUptime(65000)).toBe('1m 5s');
      expect(statusDisplay.formatUptime(3665000)).toBe('1h 1m');
    });
  });

  describe('traffic events', () => {
    test('should add traffic event', () => {
      const trafficData = {
        ip: '192.168.1.1',
        city: 'San Francisco',
        country: 'United States',
        process: 'Chrome',
        port: 443
      };
      
      statusDisplay.addTrafficEvent(trafficData);
      
      const lastTraffic = container.querySelector('#last-traffic');
      expect(lastTraffic.textContent).toBe('192.168.1.1 (San Francisco, United States)');
      
      const trafficList = container.querySelector('#traffic-list');
      expect(trafficList.querySelector('.traffic-item')).toBeTruthy();
      expect(trafficList.querySelector('.no-traffic')).toBeFalsy();
    });

    test('should limit traffic list to 10 items', () => {
      // Add 12 traffic events
      for (let i = 0; i < 12; i++) {
        const trafficData = {
          ip: `192.168.1.${i}`,
          city: 'Test City',
          country: 'Test Country',
          process: 'Test Process',
          port: 443
        };
        statusDisplay.addTrafficEvent(trafficData);
      }
      
      const trafficItems = container.querySelectorAll('.traffic-item');
      expect(trafficItems.length).toBe(10);
    });

    test('should remove no-traffic message when first event added', () => {
      expect(container.querySelector('.no-traffic')).toBeTruthy();
      
      const trafficData = {
        ip: '192.168.1.1',
        city: 'Test City',
        country: 'Test Country'
      };
      
      statusDisplay.addTrafficEvent(trafficData);
      
      expect(container.querySelector('.no-traffic')).toBeFalsy();
    });
  });

  describe('error handling', () => {
    test('should add error messages', () => {
      statusDisplay.addError('Test error message', 'error');
      
      const errorsSection = container.querySelector('#status-errors');
      expect(errorsSection.style.display).toBe('block');
      
      const errorList = container.querySelector('#error-list');
      expect(errorList.querySelector('.error-item')).toBeTruthy();
      expect(errorList.textContent).toContain('Test error message');
    });

    test('should limit error list to 5 items', () => {
      // Add 7 errors
      for (let i = 0; i < 7; i++) {
        statusDisplay.addError(`Error ${i}`, 'error');
      }
      
      const errorItems = container.querySelectorAll('.error-item');
      expect(errorItems.length).toBe(5);
    });

    test('should clear all errors', () => {
      statusDisplay.addError('Test error', 'error');
      expect(container.querySelector('.error-item')).toBeTruthy();
      
      statusDisplay.clearErrors();
      
      expect(container.querySelector('.error-item')).toBeFalsy();
      expect(container.querySelector('#status-errors').style.display).toBe('none');
    });
  });

  describe('UI interactions', () => {
    test('should toggle details section', () => {
      const detailsSection = container.querySelector('#status-details');
      const toggleButton = container.querySelector('.status-toggle');
      
      expect(detailsSection.style.display).toBe('none');
      
      toggleButton.click();
      expect(detailsSection.style.display).toBe('block');
      
      toggleButton.click();
      expect(detailsSection.style.display).toBe('none');
    });

    test('should hide panel when close button clicked', () => {
      const closeButton = container.querySelector('.status-close');
      
      expect(statusDisplay.isVisible).toBe(true);
      
      closeButton.click();
      
      expect(statusDisplay.isVisible).toBe(false);
      expect(container.querySelector('.status-panel').style.display).toBe('none');
    });

    test('should show and hide panel', () => {
      statusDisplay.hide();
      expect(statusDisplay.isVisible).toBe(false);
      
      statusDisplay.show();
      expect(statusDisplay.isVisible).toBe(true);
      
      statusDisplay.toggle();
      expect(statusDisplay.isVisible).toBe(false);
      
      statusDisplay.toggle();
      expect(statusDisplay.isVisible).toBe(true);
    });
  });

  describe('system information', () => {
    test('should detect browser information', () => {
      const browserInfo = statusDisplay.getBrowserInfo();
      expect(browserInfo).toBe('Chrome'); // Based on mocked user agent
    });

    test('should check WebGL support', () => {
      const webglSupport = statusDisplay.checkWebGLSupport();
      expect(typeof webglSupport).toBe('boolean');
    });

    test('should update system information in UI', () => {
      statusDisplay.updateSystemInfo();
      
      const browserElement = container.querySelector('#browser-info');
      const webglElement = container.querySelector('#webgl-support');
      const geoElement = container.querySelector('#geo-support');
      
      expect(browserElement.textContent).toBeTruthy();
      expect(webglElement.textContent).toBeTruthy();
      expect(geoElement.textContent).toBeTruthy();
    });
  });

  describe('configuration updates', () => {
    test('should update configuration', () => {
      const newConfig = {
        theme: 'light',
        position: 'bottom-right',
        autoHide: true
      };
      
      statusDisplay.updateConfig(newConfig);
      
      expect(statusDisplay.config.theme).toBe('light');
      expect(statusDisplay.config.position).toBe('bottom-right');
      expect(statusDisplay.config.autoHide).toBe(true);
    });

    test('should preserve existing config when updating', () => {
      const originalInterval = statusDisplay.config.updateInterval;
      
      statusDisplay.updateConfig({ theme: 'light' });
      
      expect(statusDisplay.config.theme).toBe('light');
      expect(statusDisplay.config.updateInterval).toBe(originalInterval);
    });
  });

  describe('status data', () => {
    test('should return current status', () => {
      statusDisplay.updateConnectionStatus('connected');
      statusDisplay.updateLocationStatus({ lat: 37.7749, lon: -122.4194 });
      
      const status = statusDisplay.getStatus();
      
      expect(status.connection).toBe('connected');
      expect(status.location).toEqual({ lat: 37.7749, lon: -122.4194 });
      expect(status.isVisible).toBe(true);
      expect(status.lastUpdate).toBeTruthy();
    });
  });

  describe('auto-hide functionality', () => {
    test('should schedule auto-hide when enabled', (done) => {
      const display = new StatusDisplay('status-container', {
        autoHide: true,
        autoHideDelay: 100
      });
      
      display.scheduleAutoHide();
      
      setTimeout(() => {
        expect(display.isVisible).toBe(false);
        display.destroy();
        done();
      }, 150);
    });

    test('should cancel auto-hide', () => {
      const display = new StatusDisplay('status-container', {
        autoHide: true,
        autoHideDelay: 100
      });
      
      display.scheduleAutoHide();
      display.cancelAutoHide();
      
      setTimeout(() => {
        expect(display.isVisible).toBe(true);
        display.destroy();
      }, 150);
    });
  });

  describe('cleanup', () => {
    test('should destroy properly', () => {
      statusDisplay.destroy();
      
      expect(container.innerHTML).toBe('');
      expect(document.getElementById('status-display-styles')).toBeFalsy();
    });

    test('should stop timers on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      statusDisplay.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    test('should handle invalid traffic data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Should not throw error with missing data
      statusDisplay.addTrafficEvent({});
      statusDisplay.addTrafficEvent(null);
      
      consoleSpy.mockRestore();
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove an element and ensure it doesn't crash
      const element = container.querySelector('#connection-status');
      element.remove();
      
      expect(() => {
        statusDisplay.updateConnectionStatus('connected');
      }).not.toThrow();
    });

    test('should handle rapid updates', () => {
      // Rapidly update status multiple times
      for (let i = 0; i < 100; i++) {
        statusDisplay.updateConnectionStatus('connecting');
        statusDisplay.updateConnectionStatus('connected');
      }
      
      const statusElement = container.querySelector('#connection-status');
      expect(statusElement.textContent).toBe('🟢 Connected');
    });
  });
});