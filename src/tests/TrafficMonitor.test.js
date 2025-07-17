const TrafficMonitor = require('../services/TrafficMonitor');
const EventEmitter = require('events');

// Mock child_process
jest.mock('child_process');
const { spawn } = require('child_process');

describe('TrafficMonitor', () => {
  let trafficMonitor;
  let mockProcess;

  beforeEach(() => {
    trafficMonitor = new TrafficMonitor();
    
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.pid = 12345;
    
    spawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (trafficMonitor.isRunning) {
      trafficMonitor.stop();
    }
  });

  describe('start', () => {
    test('should start lsof monitoring successfully', () => {
      const startedSpy = jest.fn();
      trafficMonitor.on('started', startedSpy);

      trafficMonitor.start();

      expect(trafficMonitor.isRunning).toBe(true);
      expect(startedSpy).toHaveBeenCalled();
      expect(trafficMonitor.cleanupInterval).not.toBeNull();
    });

    test('should not start if already running', () => {
      trafficMonitor.isRunning = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      trafficMonitor.start();

      expect(spawn).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[TrafficMonitor] Already running');
      
      consoleSpy.mockRestore();
    });

    test('should handle lsof permission errors', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      trafficMonitor.start();
      
      // Simulate lsof process and stderr output
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Operation not permitted'));
        
        setTimeout(() => {
          expect(consoleSpy).toHaveBeenCalledWith('[TrafficMonitor] lsof stderr: Operation not permitted');
          consoleSpy.mockRestore();
          done();
        }, 10);
      }, 10);
    });
  });

  describe('parseNettopLine', () => {
    test('should parse valid nettop line', () => {
      const line = 'Chrome.123,456,789,192.168.1.100:54321->8.8.8.8:443,,,';
      const result = trafficMonitor.parseNettopLine(line);

      expect(result).toEqual({
        processName: 'Chrome.123',
        sourceIP: '192.168.1.100',
        sourcePort: 54321,
        destIP: '8.8.8.8',
        destPort: 443,
        timestamp: expect.any(Number),
        rawLine: line
      });
    });

    test('should return null for invalid line', () => {
      const line = 'invalid line with no connection data';
      const result = trafficMonitor.parseNettopLine(line);

      expect(result).toBeNull();
    });

    test('should handle lines with different process name formats', () => {
      const line = 'firefox->8.8.8.8:443,1.1.1.1:12345->8.8.8.8:443';
      const result = trafficMonitor.parseNettopLine(line);

      expect(result).toEqual({
        processName: 'firefox->8.8.8.8:443',
        sourceIP: '1.1.1.1',
        sourcePort: 12345,
        destIP: '8.8.8.8',
        destPort: 443,
        timestamp: expect.any(Number),
        rawLine: line
      });
    });
  });

  describe('parseTrafficData', () => {
    test('should emit traffic events for public IPs', () => {
      const trafficSpy = jest.fn();
      trafficMonitor.on('traffic', trafficSpy);

      const data = 'Chrome.123,456,789,192.168.1.100:54321->8.8.8.8:443,,,\n';
      trafficMonitor.parseTrafficData(data);

      expect(trafficSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          destIP: '8.8.8.8',
          destPort: 443
        })
      );
    });

    test('should not emit traffic events for private IPs', () => {
      const trafficSpy = jest.fn();
      trafficMonitor.on('traffic', trafficSpy);

      const data = 'Chrome.123,456,789,192.168.1.100:54321->192.168.1.1:443,,,\n';
      trafficMonitor.parseTrafficData(data);

      expect(trafficSpy).not.toHaveBeenCalled();
    });

    test('should skip header lines', () => {
      const trafficSpy = jest.fn();
      trafficMonitor.on('traffic', trafficSpy);

      const data = 'time,process,source,destination\n---\nChrome.123,456,789,192.168.1.100:54321->8.8.8.8:443,,,\n';
      trafficMonitor.parseTrafficData(data);

      expect(trafficSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    test('should stop monitoring and clear cleanup interval', () => {
      trafficMonitor.start();
      expect(trafficMonitor.isRunning).toBe(true);
      expect(trafficMonitor.cleanupInterval).not.toBeNull();
      
      trafficMonitor.stop();
      
      expect(trafficMonitor.isRunning).toBe(false);
      expect(trafficMonitor.cleanupInterval).toBeNull();
    });

    test('should not attempt to stop if not running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      trafficMonitor.stop();

      expect(consoleSpy).toHaveBeenCalledWith('[TrafficMonitor] Not running');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    test('should return correct status when running', () => {
      trafficMonitor.start();
      const status = trafficMonitor.getStatus();

      expect(status).toEqual({
        isRunning: true,
        processId: null,
        restartAttempts: 0,
        maxRestartAttempts: 3,
        deduplication: {
          processedIPsCount: 0,
          connectionStatesCount: 0,
          ipLastSeenCount: 0,
          isCleanupRunning: true
        }
      });
    });

    test('should return correct status when not running', () => {
      const status = trafficMonitor.getStatus();

      expect(status).toEqual({
        isRunning: false,
        processId: null,
        restartAttempts: 0,
        maxRestartAttempts: 3,
        deduplication: {
          processedIPsCount: 0,
          connectionStatesCount: 0,
          ipLastSeenCount: 0,
          isCleanupRunning: false
        }
      });
    });
  });

  describe('deduplication and connection state tracking', () => {
    describe('constructor initialization', () => {
      test('should initialize deduplication structures', () => {
        expect(trafficMonitor.processedIPs).toBeInstanceOf(Set);
        expect(trafficMonitor.connectionStates).toBeInstanceOf(Map);
        expect(trafficMonitor.ipLastSeen).toBeInstanceOf(Map);
        expect(trafficMonitor.cleanupInterval).toBeNull();
        expect(trafficMonitor.ipCacheTimeout).toBe(300000);
        expect(trafficMonitor.connectionCacheTimeout).toBe(60000);
      });
    });

    describe('isNewConnection', () => {
      test('should identify new connections correctly', () => {
        const connectionKey = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const destIP = '1.2.3.4';
        
        // First check should return true (new connection)
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(true);
        
        // Update state
        trafficMonitor.updateConnectionState(connectionKey, destIP);
        
        // Second check should return false (duplicate)
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(false);
      });

      test('should respect IP cache timeout', () => {
        const connectionKey = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const destIP = '1.2.3.4';
        
        // Mock Date.now to simulate time passage
        const originalNow = Date.now;
        let mockTime = 1000000;
        Date.now = jest.fn(() => mockTime);
        
        // Update state at time 1000000
        trafficMonitor.updateConnectionState(connectionKey, destIP);
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(false);
        
        // Advance time beyond IP cache timeout (5 minutes)
        mockTime += 301000; // 5 minutes + 1 second
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(true);
        
        // Restore original Date.now
        Date.now = originalNow;
      });

      test('should respect connection cache timeout', () => {
        const connectionKey = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const destIP = '1.2.3.4';
        
        // Mock Date.now to simulate time passage
        const originalNow = Date.now;
        let mockTime = 1000000;
        Date.now = jest.fn(() => mockTime);
        
        // Update state at time 1000000
        trafficMonitor.updateConnectionState(connectionKey, destIP);
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(false);
        
        // Advance time beyond connection cache timeout (1 minute) but within IP timeout
        mockTime += 61000; // 1 minute + 1 second
        expect(trafficMonitor.isNewConnection(connectionKey, destIP)).toBe(false); // Still blocked by IP cache
        
        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('updateConnectionState', () => {
      test('should track connection states correctly', () => {
        const connectionKey = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const destIP = '1.2.3.4';
        
        trafficMonitor.updateConnectionState(connectionKey, destIP);
        
        expect(trafficMonitor.connectionStates.has(connectionKey)).toBe(true);
        expect(trafficMonitor.ipLastSeen.has(destIP)).toBe(true);
        expect(trafficMonitor.processedIPs.has(destIP)).toBe(true);
      });
    });

    describe('cleanupStaleConnections', () => {
      test('should clean up stale connections', () => {
        const connectionKey1 = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const connectionKey2 = 'Firefox:192.168.1.100:54321->5.6.7.8:80';
        
        // Add both connections to state
        trafficMonitor.connectionStates.set(connectionKey1, Date.now());
        trafficMonitor.connectionStates.set(connectionKey2, Date.now());
        
        // Create current connections set with only one connection
        const currentConnections = new Set([connectionKey1]);
        
        trafficMonitor.cleanupStaleConnections(currentConnections);
        
        // Only the active connection should remain
        expect(trafficMonitor.connectionStates.has(connectionKey1)).toBe(true);
        expect(trafficMonitor.connectionStates.has(connectionKey2)).toBe(false);
      });
    });

    describe('cleanupExpiredEntries', () => {
      test('should clean up expired entries', () => {
        const connectionKey = 'Chrome:192.168.1.100:12345->1.2.3.4:443';
        const destIP = '1.2.3.4';
        
        // Mock Date.now to simulate time passage
        const originalNow = Date.now;
        let mockTime = 1000000;
        Date.now = jest.fn(() => mockTime);
        
        // Add entries at time 1000000
        trafficMonitor.connectionStates.set(connectionKey, mockTime);
        trafficMonitor.ipLastSeen.set(destIP, mockTime);
        trafficMonitor.processedIPs.add(destIP);
        
        // Advance time beyond both timeouts
        mockTime += 301000; // 5 minutes + 1 second
        
        trafficMonitor.cleanupExpiredEntries();
        
        // All entries should be cleaned up
        expect(trafficMonitor.connectionStates.has(connectionKey)).toBe(false);
        expect(trafficMonitor.ipLastSeen.has(destIP)).toBe(false);
        expect(trafficMonitor.processedIPs.has(destIP)).toBe(false);
        
        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('parseConnectionData with deduplication', () => {
      test('should emit events only for new connections', () => {
        const mockData = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
Chrome     1234   user  123u  IPv4 0x123456      0t0  TCP 192.168.1.100:12345->1.2.3.4:443 (ESTABLISHED)
Chrome     1234   user  124u  IPv4 0x123457      0t0  TCP 192.168.1.100:12346->5.6.7.8:80 (ESTABLISHED)
Chrome     1234   user  123u  IPv4 0x123456      0t0  TCP 192.168.1.100:12345->1.2.3.4:443 (ESTABLISHED)`;
        
        const trafficEvents = [];
        trafficMonitor.on('traffic', (data) => {
          trafficEvents.push(data);
        });
        
        trafficMonitor.parseConnectionData(mockData);
        
        // Should emit 2 events (unique connections), not 3
        expect(trafficEvents).toHaveLength(2);
        expect(trafficEvents[0].destIP).toBe('1.2.3.4');
        expect(trafficEvents[1].destIP).toBe('5.6.7.8');
      });

      test('should filter private IPs and not track them', () => {
        const mockData = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
Chrome     1234   user  123u  IPv4 0x123456      0t0  TCP 192.168.1.100:12345->192.168.1.1:80 (ESTABLISHED)
Chrome     1234   user  124u  IPv4 0x123457      0t0  TCP 192.168.1.100:12346->1.2.3.4:443 (ESTABLISHED)`;
        
        const trafficEvents = [];
        trafficMonitor.on('traffic', (data) => {
          trafficEvents.push(data);
        });
        
        trafficMonitor.parseConnectionData(mockData);
        
        // Should emit 1 event (only public IP), private IP should be filtered
        expect(trafficEvents).toHaveLength(1);
        expect(trafficEvents[0].destIP).toBe('1.2.3.4');
        
        // Private IP should not be in tracking state
        expect(trafficMonitor.processedIPs.has('192.168.1.1')).toBe(false);
        expect(trafficMonitor.processedIPs.has('1.2.3.4')).toBe(true);
      });
    });

    describe('cleanup interval management', () => {
      test('should start and stop cleanup interval', () => {
        // Mock setInterval and clearInterval
        const originalSetInterval = global.setInterval;
        const originalClearInterval = global.clearInterval;
        const mockSetInterval = jest.fn(() => 'mock-interval-id');
        const mockClearInterval = jest.fn();
        global.setInterval = mockSetInterval;
        global.clearInterval = mockClearInterval;
        
        // Start should set up cleanup interval
        trafficMonitor.startCleanupInterval();
        expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
        expect(trafficMonitor.cleanupInterval).toBe('mock-interval-id');
        
        // Manually set isRunning to true to simulate started state
        trafficMonitor.isRunning = true;
        
        // Stop should clear cleanup interval
        trafficMonitor.stop();
        expect(mockClearInterval).toHaveBeenCalledWith('mock-interval-id');
        expect(trafficMonitor.cleanupInterval).toBeNull();
        
        // Restore original functions
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
      });

      test('should clear all caches on stop', () => {
        // Start first to initialize the monitor
        trafficMonitor.start();
        
        // Add some data to caches
        trafficMonitor.processedIPs.add('1.2.3.4');
        trafficMonitor.connectionStates.set('conn1', Date.now());
        trafficMonitor.ipLastSeen.set('1.2.3.4', Date.now());
        
        trafficMonitor.stop();
        
        // All caches should be cleared
        expect(trafficMonitor.processedIPs.size).toBe(0);
        expect(trafficMonitor.connectionStates.size).toBe(0);
        expect(trafficMonitor.ipLastSeen.size).toBe(0);
      });
    });

    describe('getDeduplicationStats', () => {
      test('should return correct statistics', () => {
        trafficMonitor.processedIPs.add('1.2.3.4');
        trafficMonitor.processedIPs.add('5.6.7.8');
        trafficMonitor.connectionStates.set('conn1', Date.now());
        trafficMonitor.ipLastSeen.set('1.2.3.4', Date.now());
        
        const stats = trafficMonitor.getDeduplicationStats();
        
        expect(stats).toEqual({
          processedIPsCount: 2,
          connectionStatesCount: 1,
          ipLastSeenCount: 1,
          isCleanupRunning: false
        });
      });
    });

    describe('parseLsofLine', () => {
      test('should parse valid lsof line with ESTABLISHED TCP connection', () => {
        const line = 'Chrome    1234 user  123u  IPv4 0x123456      0t0  TCP 192.168.1.100:12345->1.2.3.4:443 (ESTABLISHED)';
        const result = trafficMonitor.parseLsofLine(line);
        
        expect(result).toEqual({
          processName: 'Chrome',
          sourceIP: '192.168.1.100',
          sourcePort: 12345,
          destIP: '1.2.3.4',
          destPort: 443,
          timestamp: expect.any(Number),
          rawLine: line
        });
      });

      test('should return null for non-TCP connections', () => {
        const line = 'Chrome    1234 user  123u  IPv4 0x123456      0t0  UDP 192.168.1.100:12345->1.2.3.4:443';
        const result = trafficMonitor.parseLsofLine(line);
        
        expect(result).toBeNull();
      });

      test('should return null for non-ESTABLISHED connections', () => {
        const line = 'Chrome    1234 user  123u  IPv4 0x123456      0t0  TCP 192.168.1.100:12345->1.2.3.4:443 (LISTEN)';
        const result = trafficMonitor.parseLsofLine(line);
        
        expect(result).toBeNull();
      });
    });
  });

  describe('getStatus with deduplication', () => {
    test('should include deduplication stats in status', () => {
      trafficMonitor.processedIPs.add('1.2.3.4');
      trafficMonitor.connectionStates.set('conn1', Date.now());
      
      const status = trafficMonitor.getStatus();
      
      expect(status).toEqual({
        isRunning: false,
        processId: null,
        restartAttempts: 0,
        maxRestartAttempts: 3,
        deduplication: {
          processedIPsCount: 1,
          connectionStatesCount: 1,
          ipLastSeenCount: 0,
          isCleanupRunning: false
        }
      });
    });
  });
});