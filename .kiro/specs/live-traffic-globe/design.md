# Design Document

## Overview

The Live Traffic Globe system is architected as a two-component solution: a Node.js backend agent that monitors network traffic locally and a web-based frontend that visualizes the data on a 3D globe. The system uses WebSocket communication for real-time data streaming and leverages macOS built-in networking tools for secure traffic monitoring.

## Architecture

### System Components

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Backend Agent │ ◄──────────────► │  Web Frontend   │
│   (Node.js)     │                 │   (Browser)     │
└─────────────────┘                 └─────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│     nettop      │                 │   globe.gl      │
│  (macOS Tool)   │                 │  (3D Library)   │
└─────────────────┘                 └─────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│ IP Geolocation  │                 │  Browser APIs   │
│   API Service   │                 │ (Geolocation)   │
└─────────────────┘                 └─────────────────┘
```

### Data Flow

1. **Traffic Capture**: Backend spawns `nettop` process to monitor outgoing connections
2. **IP Extraction**: Parse nettop output to extract destination IP addresses
3. **Geolocation**: Query IP geolocation API to get coordinates for destination IPs
4. **Real-time Streaming**: Send geolocation data to frontend via WebSocket
5. **Visualization**: Frontend renders animated arcs on 3D globe from user location to destinations

## Components and Interfaces

### Backend Agent (`agent.js`)

**Core Responsibilities:**
- Network traffic monitoring using macOS `nettop` command
- IP address extraction and filtering
- Geolocation API integration
- WebSocket server for real-time communication
- Error handling and logging

**Key Modules:**
- `TrafficMonitor`: Manages nettop subprocess and parses output
- `GeolocationService`: Handles IP-to-coordinates conversion
- `WebSocketServer`: Manages client connections and data streaming
- `IPFilter`: Filters out private/local IP addresses

**External Dependencies:**
- `ws`: WebSocket server implementation
- `node-fetch`: HTTP client for geolocation API calls
- `child_process`: For spawning nettop subprocess

### Web Frontend (`index.html`)

**Core Responsibilities:**
- 3D globe rendering and interaction
- Real-time data visualization
- User location acquisition
- Connection status management
- Arc animation and lifecycle management

**Key Components:**
- `GlobeRenderer`: Manages 3D globe using globe.gl library
- `WebSocketClient`: Handles real-time data connection
- `LocationService`: Acquires user's geographic location
- `ArcManager`: Manages arc data and animations
- `StatusDisplay`: Shows connection and system status

**External Dependencies:**
- `globe.gl`: 3D globe visualization library
- `three.js`: 3D graphics library (dependency of globe.gl)
- Browser Geolocation API

## Data Models

### Traffic Data Model

```javascript
// Raw nettop output format (parsed)
{
  processName: string,
  sourceIP: string,
  sourcePort: number,
  destIP: string,
  destPort: number,
  bytesOut: number
}

// Geolocation API response
{
  status: 'success' | 'fail',
  country: string,
  countryCode: string,
  region: string,
  regionName: string,
  city: string,
  zip: string,
  lat: number,
  lon: number,
  timezone: string,
  isp: string,
  org: string,
  as: string,
  query: string // IP address
}

// WebSocket message format
{
  ip: string,
  lat: number,
  lon: number,
  city: string,
  country: string,
  timestamp: number
}

// Frontend arc data model
{
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  ip: string,
  city: string,
  country: string,
  id: string,
  timestamp: number
}
```

### Configuration Model

```javascript
// Backend configuration
{
  websocketPort: number,
  geolocationApiUrl: string,
  maxArcsRetained: number,
  nettopArgs: string[],
  ipFilterRules: string[]
}

// Frontend configuration
{
  websocketUrl: string,
  globeImageUrl: string,
  arcAnimationDuration: number,
  maxArcsDisplayed: number,
  defaultViewAltitude: number
}
```

## Error Handling

### Backend Error Scenarios

1. **Permission Denied**: When nettop requires sudo privileges
   - Display clear error message with instructions
   - Gracefully exit with appropriate error code

2. **Geolocation API Failures**: When IP geolocation requests fail
   - Log error with IP address and error details
   - Continue processing other traffic (non-blocking)
   - Implement rate limiting to prevent API abuse

3. **WebSocket Connection Issues**: When frontend disconnects
   - Clean up nettop subprocess
   - Log disconnection event
   - Prepare for new connections

4. **nettop Process Failures**: When traffic monitoring fails
   - Detect process exit codes
   - Attempt restart with exponential backoff
   - Notify connected clients of monitoring status

### Frontend Error Scenarios

1. **WebSocket Connection Failures**: When backend is unavailable
   - Display connection status to user
   - Implement automatic reconnection with backoff
   - Show helpful troubleshooting messages

2. **Geolocation Permission Denied**: When user blocks location access
   - Use default location (e.g., center of user's country)
   - Display informational message about reduced functionality

3. **Globe Rendering Issues**: When 3D graphics fail
   - Provide fallback 2D visualization
   - Display browser compatibility information

## Testing Strategy

### Backend Testing

1. **Unit Tests**:
   - IP filtering logic validation
   - nettop output parsing accuracy
   - Geolocation API response handling
   - WebSocket message formatting

2. **Integration Tests**:
   - End-to-end traffic capture and processing
   - WebSocket communication with mock clients
   - Error handling scenarios

3. **System Tests**:
   - Real network traffic monitoring
   - Performance under high traffic loads
   - Memory usage and cleanup verification

### Frontend Testing

1. **Unit Tests**:
   - Arc data processing and validation
   - WebSocket message handling
   - Location coordinate calculations

2. **Integration Tests**:
   - Globe rendering with mock data
   - Real-time data visualization
   - User interaction handling

3. **Browser Compatibility Tests**:
   - Cross-browser WebGL support
   - Geolocation API availability
   - WebSocket connection stability

### Security Considerations

1. **Data Privacy**:
   - Only process destination IP addresses, not packet contents
   - No persistent storage of traffic data
   - Local processing only (no external data transmission except geolocation)

2. **System Permissions**:
   - Minimal required privileges for network monitoring
   - Clear user consent for system access
   - Graceful degradation when permissions unavailable

3. **Network Security**:
   - WebSocket server bound to localhost only
   - No external API keys stored in frontend code
   - Rate limiting for geolocation API requests