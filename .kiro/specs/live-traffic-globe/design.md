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
- 3D globe rendering and interaction with advanced visual effects
- Real-time data visualization with process-based colorization
- User location acquisition
- Connection status management
- Arc animation and lifecycle management with particle effects
- User interface controls and filtering system
- Animation and visual effects management

**Key Components:**
- `GlobeRenderer`: Manages 3D globe using globe.gl library with enhanced visual effects
- `WebSocketClient`: Handles real-time data connection
- `LocationService`: Acquires user's geographic location
- `ArcManager`: Manages arc data, animations, and visual effects
- `StatusDisplay`: Shows connection and system status
- `ProcessColorizer`: Manages color schemes for different process types
- `AnimationEngine`: Handles smooth transitions and particle effects
- `ControlPanel`: Manages user interface controls and filters
- `FilterManager`: Handles traffic filtering by process, geography, and time
- `PresetManager`: Manages saving/loading of visualization presets

**External Dependencies:**
- `globe.gl`: 3D globe visualization library
- `three.js`: 3D graphics library (dependency of globe.gl)
- Browser Geolocation API
- CSS3 animations and transitions
- Web Animations API for advanced effects

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

### Enhanced Data Models

```javascript
// Enhanced WebSocket message format with process information
{
  ip: string,
  lat: number,
  lon: number,
  city: string,
  country: string,
  processName: string,
  processType: string, // 'browser', 'system', 'media', 'development', 'other'
  bytesOut: number,
  timestamp: number
}

// Enhanced frontend arc data model with visual properties
{
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  ip: string,
  city: string,
  country: string,
  processName: string,
  processType: string,
  color: string,
  thickness: number,
  intensity: number,
  id: string,
  timestamp: number,
  animationPhase: 'appearing' | 'active' | 'fading'
}

// Process color scheme configuration
{
  browser: { primary: '#4A90E2', secondary: '#7BB3F0', particles: '#B8D4F0' },
  system: { primary: '#50C878', secondary: '#7DD87F', particles: '#B8E6C1' },
  media: { primary: '#9B59B6', secondary: '#B574C4', particles: '#D7BDE2' },
  development: { primary: '#E67E22', secondary: '#F39C12', particles: '#F8C471' },
  other: { primary: '#95A5A6', secondary: '#BDC3C7', particles: '#D5DBDB' }
}

// User interface filter state
{
  processFilters: {
    browser: boolean,
    system: boolean,
    media: boolean,
    development: boolean,
    other: boolean
  },
  geographicFilters: {
    continents: string[],
    countries: string[],
    excludeRegions: string[]
  },
  visualSettings: {
    arcThickness: number, // 1-10 scale
    animationSpeed: number, // 0.5-3.0 multiplier
    particleIntensity: number, // 0-100 percentage
    glowIntensity: number, // 0-100 percentage
    arcLifetime: number // seconds
  },
  displayOptions: {
    showConnectionDetails: boolean,
    showProcessLabels: boolean,
    showGeographicLabels: boolean,
    pauseLiveFeed: boolean
  }
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
  ipFilterRules: string[],
  processClassification: {
    browser: string[], // process name patterns
    system: string[],
    media: string[],
    development: string[]
  }
}

// Enhanced frontend configuration
{
  websocketUrl: string,
  globeImageUrl: string,
  arcAnimationDuration: number,
  maxArcsDisplayed: number,
  defaultViewAltitude: number,
  visualEffects: {
    enableParticles: boolean,
    enableGlow: boolean,
    enablePulse: boolean,
    frameRate: number
  },
  userInterface: {
    controlPanelPosition: 'left' | 'right',
    theme: 'dark' | 'light' | 'auto',
    showTooltips: boolean,
    enableKeyboardShortcuts: boolean
  }
}
```

## Visual Effects and Animation System

### Process-Based Colorization

**Color Scheme Design:**
- **Browsers**: Blue spectrum (#4A90E2 to #7BB3F0) - representing web connectivity
- **System Processes**: Green spectrum (#50C878 to #7DD87F) - representing system health
- **Media Applications**: Purple spectrum (#9B59B6 to #B574C4) - representing creativity
- **Development Tools**: Orange spectrum (#E67E22 to #F39C12) - representing productivity
- **Other/Unknown**: Gray spectrum (#95A5A6 to #BDC3C7) - neutral representation

**Implementation:**
- Dynamic color assignment based on process name pattern matching
- Gradient effects along arc paths using WebGL shaders
- Color intensity variation based on traffic volume
- Smooth color transitions for process type changes

### Advanced Animation System

**Arc Animation Phases:**
1. **Appearance Phase** (0.5s): Arc grows from origin with particle trail
2. **Active Phase** (configurable): Full arc display with pulsing effects
3. **Fade Phase** (1.0s): Gradual fade with particle dispersion

**Animation Techniques:**
- Bezier curve interpolation for smooth arc paths
- Easing functions (ease-out-cubic) for natural motion
- Particle systems using Three.js for trail effects
- WebGL shaders for glow and pulse effects
- CSS3 transforms for UI element animations

**Performance Optimization:**
- Object pooling for arc and particle instances
- Level-of-detail (LOD) system for distant arcs
- Automatic quality adjustment based on frame rate
- Efficient culling of off-screen elements

### User Interface Controls

**Control Panel Layout:**
```
┌─────────────────────────────┐
│ LIVE TRAFFIC GLOBE          │
├─────────────────────────────┤
│ ◉ Live Feed    ⏸ Pause     │
├─────────────────────────────┤
│ PROCESS FILTERS             │
│ ☑ Browsers     ☑ System     │
│ ☑ Media        ☑ Dev Tools  │
│ ☑ Other                     │
├─────────────────────────────┤
│ VISUAL SETTINGS             │
│ Arc Thickness    ●────○     │
│ Animation Speed  ●──○──     │
│ Particle Effects ●───○─     │
│ Glow Intensity   ●────○     │
├─────────────────────────────┤
│ GEOGRAPHIC FILTERS          │
│ [Continent Dropdown]        │
│ [Country Multi-select]      │
├─────────────────────────────┤
│ PRESETS                     │
│ [Save Current] [Load...]    │
└─────────────────────────────┘
```

**Interactive Features:**
- Real-time filter application without page refresh
- Slider controls with immediate visual feedback
- Keyboard shortcuts for common actions
- Contextual tooltips and help system
- Responsive design for mobile devices

## Technical Implementation Details

### Process Classification System

**Backend Process Detection:**
```javascript
// Process classification patterns
const PROCESS_PATTERNS = {
  browser: [
    /chrome/i, /firefox/i, /safari/i, /edge/i, /opera/i,
    /brave/i, /vivaldi/i, /arc/i
  ],
  system: [
    /kernel/i, /system/i, /daemon/i, /service/i, /update/i,
    /security/i, /backup/i, /sync/i
  ],
  media: [
    /spotify/i, /vlc/i, /quicktime/i, /music/i, /video/i,
    /netflix/i, /youtube/i, /streaming/i
  ],
  development: [
    /code/i, /git/i, /node/i, /npm/i, /docker/i, /terminal/i,
    /xcode/i, /intellij/i, /vscode/i
  ]
};

// Enhanced traffic data structure
class TrafficConnection {
  constructor(data) {
    this.processName = data.processName;
    this.processType = this.classifyProcess(data.processName);
    this.destIP = data.destIP;
    this.bytesOut = data.bytesOut;
    this.timestamp = Date.now();
  }
  
  classifyProcess(processName) {
    for (const [type, patterns] of Object.entries(PROCESS_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(processName))) {
        return type;
      }
    }
    return 'other';
  }
}
```

### Advanced WebGL Shader System

**Arc Gradient Shader:**
```glsl
// Vertex shader for arc gradients
attribute vec3 position;
attribute float progress; // 0.0 to 1.0 along arc
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 startColor;
uniform vec3 endColor;
uniform float intensity;
varying vec3 vColor;
varying float vIntensity;

void main() {
  // Interpolate color along arc path
  vColor = mix(startColor, endColor, progress);
  vIntensity = intensity * (1.0 - abs(progress - 0.5) * 2.0); // Peak at center
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader for glow effects
precision mediump float;
varying vec3 vColor;
varying float vIntensity;
uniform float glowStrength;

void main() {
  float glow = pow(vIntensity, 2.0) * glowStrength;
  vec3 finalColor = vColor + vec3(glow * 0.3);
  gl_FragColor = vec4(finalColor, vIntensity);
}
```

### Particle System Architecture

**Particle Trail Implementation:**
```javascript
class ParticleTrail {
  constructor(arc, particleCount = 20) {
    this.arc = arc;
    this.particles = [];
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(arc.color) },
        opacity: { value: 0.8 },
        size: { value: 2.0 }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    
    this.initializeParticles(particleCount);
  }
  
  initializeParticles(count) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const arcPoint = this.arc.getPointAt(progress);
      
      positions[i * 3] = arcPoint.x;
      positions[i * 3 + 1] = arcPoint.y;
      positions[i * 3 + 2] = arcPoint.z;
      
      lifetimes[i] = Math.random() * 2.0 + 1.0; // 1-3 seconds
    }
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    this.geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  }
  
  update(deltaTime) {
    const positions = this.geometry.attributes.position.array;
    const velocities = this.geometry.attributes.velocity.array;
    const lifetimes = this.geometry.attributes.lifetime.array;
    
    for (let i = 0; i < lifetimes.length; i++) {
      lifetimes[i] -= deltaTime;
      
      if (lifetimes[i] <= 0) {
        // Respawn particle at arc start
        const startPoint = this.arc.getPointAt(0);
        positions[i * 3] = startPoint.x;
        positions[i * 3 + 1] = startPoint.y;
        positions[i * 3 + 2] = startPoint.z;
        lifetimes[i] = Math.random() * 2.0 + 1.0;
      } else {
        // Move particle along arc
        positions[i * 3] += velocities[i * 3] * deltaTime;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;
      }
    }
    
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.lifetime.needsUpdate = true;
  }
}
```

### Animation State Machine

**Arc Lifecycle Management:**
```javascript
class ArcAnimationStateMachine {
  constructor(arc) {
    this.arc = arc;
    this.state = 'appearing';
    this.stateTime = 0;
    this.totalTime = 0;
    
    this.states = {
      appearing: {
        duration: 0.5,
        update: this.updateAppearing.bind(this),
        next: 'active'
      },
      active: {
        duration: this.arc.lifetime || 5.0,
        update: this.updateActive.bind(this),
        next: 'fading'
      },
      fading: {
        duration: 1.0,
        update: this.updateFading.bind(this),
        next: 'complete'
      },
      complete: {
        duration: 0,
        update: () => {},
        next: null
      }
    };
  }
  
  update(deltaTime) {
    this.stateTime += deltaTime;
    this.totalTime += deltaTime;
    
    const currentState = this.states[this.state];
    currentState.update(deltaTime);
    
    if (this.stateTime >= currentState.duration && currentState.next) {
      this.state = currentState.next;
      this.stateTime = 0;
    }
    
    return this.state !== 'complete';
  }
  
  updateAppearing(deltaTime) {
    const progress = this.stateTime / this.states.appearing.duration;
    const easedProgress = this.easeOutCubic(progress);
    
    this.arc.setVisibility(easedProgress);
    this.arc.setGrowth(easedProgress);
  }
  
  updateActive(deltaTime) {
    const pulseFreq = 2.0; // Hz
    const pulse = Math.sin(this.totalTime * pulseFreq * Math.PI * 2) * 0.1 + 0.9;
    this.arc.setIntensity(pulse);
  }
  
  updateFading(deltaTime) {
    const progress = this.stateTime / this.states.fading.duration;
    const easedProgress = this.easeInCubic(progress);
    
    this.arc.setVisibility(1.0 - easedProgress);
    this.arc.disperseParticles(easedProgress);
  }
  
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  easeInCubic(t) {
    return t * t * t;
  }
}
```

### Performance Optimization System

**Level of Detail (LOD) Management:**
```javascript
class PerformanceManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.frameRate = 60;
    this.frameHistory = [];
    this.qualityLevel = 'high'; // high, medium, low
    
    this.qualitySettings = {
      high: {
        maxArcs: 200,
        particlesPerArc: 20,
        enableGlow: true,
        enableParticles: true,
        shadowQuality: 'high'
      },
      medium: {
        maxArcs: 100,
        particlesPerArc: 10,
        enableGlow: true,
        enableParticles: false,
        shadowQuality: 'medium'
      },
      low: {
        maxArcs: 50,
        particlesPerArc: 5,
        enableGlow: false,
        enableParticles: false,
        shadowQuality: 'low'
      }
    };
  }
  
  updateFrameRate(deltaTime) {
    const fps = 1 / deltaTime;
    this.frameHistory.push(fps);
    
    if (this.frameHistory.length > 60) {
      this.frameHistory.shift();
    }
    
    const avgFps = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    
    // Adjust quality based on performance
    if (avgFps < 30 && this.qualityLevel !== 'low') {
      this.adjustQuality('down');
    } else if (avgFps > 50 && this.qualityLevel !== 'high') {
      this.adjustQuality('up');
    }
  }
  
  adjustQuality(direction) {
    const levels = ['low', 'medium', 'high'];
    const currentIndex = levels.indexOf(this.qualityLevel);
    
    if (direction === 'down' && currentIndex > 0) {
      this.qualityLevel = levels[currentIndex - 1];
    } else if (direction === 'up' && currentIndex < levels.length - 1) {
      this.qualityLevel = levels[currentIndex + 1];
    }
    
    this.applyQualitySettings();
  }
  
  applyQualitySettings() {
    const settings = this.qualitySettings[this.qualityLevel];
    
    // Update all arc managers with new settings
    this.scene.traverse((object) => {
      if (object.userData.isArc) {
        object.userData.arcManager.updateQuality(settings);
      }
    });
  }
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