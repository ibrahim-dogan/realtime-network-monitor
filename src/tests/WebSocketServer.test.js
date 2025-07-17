const WebSocketServer = require('../services/WebSocketServer');
const WebSocket = require('ws');
const EventEmitter = require('events');

// Mock ws module
jest.mock('ws');

describe('WebSocketServer', () => {
  let wsServer;
  let mockServer;
  let mockClient;

  beforeEach(() => {
    wsServer = new WebSocketServer(8081);
    
    // Create mock WebSocket server
    mockServer = new EventEmitter();
    mockServer.close = jest.fn((callback) => {
      if (callback) callback();
    });
    
    // Create mock WebSocket client
    mockClient = new EventEmitter();
    mockClient.readyState = WebSocket.OPEN;
    mockClient.send = jest.fn();
    mockClient.close = jest.fn();
    mockClient.clientInfo = {
      id: 'test_client_123',
      ip: '127.0.0.1',
      userAgent: 'Test Agent',
      connectedAt: new Date().toISOString()
    };
    
    WebSocket.Server.mockImplementation(() => mockServer);
    WebSocket.OPEN = 1;
    WebSocket.CONNECTING = 0;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (wsServer.isRunning) {
      wsServer.stop();
    }
  });

  describe('start', () => {
    test('should start WebSocket server successfully', () => {
      const startedSpy = jest.fn();
      wsServer.on('started', startedSpy);

      wsServer.start();

      expect(WebSocket.Server).toHaveBeenCalledWith({
        port: 8081,
        host: 'localhost'
      });

      // Simulate server listening
      mockServer.emit('listening');

      expect(wsServer.isRunning).toBe(true);
      expect(startedSpy).toHaveBeenCalled();
    });

    test('should not start if already running', () => {
      wsServer.isRunning = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      wsServer.start();

      expect(WebSocket.Server).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[WebSocketServer] Already running');
      
      consoleSpy.mockRestore();
    });

    test('should handle server errors', () => {
      const errorSpy = jest.fn();
      wsServer.on('error', errorSpy);

      wsServer.start();
      
      const error = new Error('Port already in use');
      mockServer.emit('error', error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('handleConnection', () => {
    beforeEach(() => {
      wsServer.start();
      mockServer.emit('listening');
    });

    test('should handle new client connections', () => {
      const clientConnectedSpy = jest.fn();
      wsServer.on('clientConnected', clientConnectedSpy);

      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'Test Browser' }
      };

      mockServer.emit('connection', mockClient, mockRequest);

      expect(wsServer.clients.has(mockClient)).toBe(true);
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"welcome"')
      );
      expect(clientConnectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'Test Browser'
        })
      );
    });

    test('should handle client disconnection', () => {
      const clientDisconnectedSpy = jest.fn();
      wsServer.on('clientDisconnected', clientDisconnectedSpy);

      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {}
      };

      mockServer.emit('connection', mockClient, mockRequest);
      mockClient.emit('close', 1000, 'Normal closure');

      expect(wsServer.clients.has(mockClient)).toBe(false);
      expect(clientDisconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      wsServer.start();
      mockServer.emit('listening');
      
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {}
      };
      mockServer.emit('connection', mockClient, mockRequest);
    });

    test('should handle ping messages', () => {
      const pingMessage = JSON.stringify({ type: 'ping' });
      mockClient.emit('message', Buffer.from(pingMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    test('should handle status messages', () => {
      const statusMessage = JSON.stringify({ type: 'status' });
      mockClient.emit('message', Buffer.from(statusMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );
    });

    test('should handle invalid JSON messages', () => {
      const invalidMessage = 'invalid json';
      mockClient.emit('message', Buffer.from(invalidMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('broadcast', () => {
    beforeEach(() => {
      wsServer.start();
      mockServer.emit('listening');
    });

    test('should broadcast message to all connected clients', () => {
      // Add multiple clients
      const mockClient2 = { ...mockClient, send: jest.fn(), readyState: WebSocket.OPEN };
      wsServer.clients.add(mockClient);
      wsServer.clients.add(mockClient2);

      const message = { type: 'traffic', data: 'test' };
      wsServer.broadcast(message);

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"traffic"')
      );
      expect(mockClient2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"traffic"')
      );
    });

    test('should queue message when no clients connected', () => {
      const message = { type: 'traffic', data: 'test' };
      wsServer.broadcast(message);

      expect(wsServer.messageQueue).toHaveLength(1);
      expect(wsServer.messageQueue[0]).toEqual(
        expect.objectContaining({
          type: 'traffic',
          data: 'test'
        })
      );
    });

    test('should handle invalid messages', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      wsServer.broadcast(null);
      wsServer.broadcast('invalid');

      expect(consoleSpy).toHaveBeenCalledWith('[WebSocketServer] Invalid message for broadcast');
      
      consoleSpy.mockRestore();
    });
  });

  describe('sendToClient', () => {
    test('should send message to specific client', () => {
      const message = { type: 'test', data: 'hello' };
      wsServer.sendToClient(mockClient, message);

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test"')
      );
    });

    test('should handle closed client connections', () => {
      mockClient.readyState = WebSocket.CLOSED;
      wsServer.clients.add(mockClient);

      const message = { type: 'test', data: 'hello' };
      wsServer.sendToClient(mockClient, message);

      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('should stop server and close all connections', () => {
      wsServer.start();
      mockServer.emit('listening');
      wsServer.clients.add(mockClient);

      const stoppedSpy = jest.fn();
      wsServer.on('stopped', stoppedSpy);

      wsServer.stop();

      expect(mockClient.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(mockServer.close).toHaveBeenCalled();
      expect(wsServer.clients.size).toBe(0);
    });

    test('should not attempt to stop if not running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      wsServer.stop();

      expect(consoleSpy).toHaveBeenCalledWith('[WebSocketServer] Not running');
      expect(mockServer.close).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    test('should return correct status information', () => {
      wsServer.start();
      mockServer.emit('listening');
      wsServer.clients.add(mockClient);

      const status = wsServer.getStatus();

      expect(status).toEqual({
        isRunning: true,
        port: 8081,
        clientCount: 1,
        queueSize: 0,
        maxQueueSize: 1000,
        uptime: expect.any(Number)
      });
    });
  });

  describe('message queue', () => {
    test('should clear message queue', () => {
      wsServer.queueMessage({ type: 'test' });
      expect(wsServer.messageQueue).toHaveLength(1);

      wsServer.clearQueue();
      expect(wsServer.messageQueue).toHaveLength(0);
    });

    test('should limit queue size', () => {
      wsServer.maxQueueSize = 2;
      
      wsServer.queueMessage({ type: 'test1' });
      wsServer.queueMessage({ type: 'test2' });
      wsServer.queueMessage({ type: 'test3' }); // Should remove first message

      expect(wsServer.messageQueue).toHaveLength(2);
      expect(wsServer.messageQueue[0].type).toBe('test2');
      expect(wsServer.messageQueue[1].type).toBe('test3');
    });
  });
});