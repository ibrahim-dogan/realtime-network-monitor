/**
 * GlobeRenderer class using globe.gl library
 * Based on working GitHub Globe implementation
 */
class GlobeRenderer {
  constructor(containerId, config = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.globe = null;
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      defaultViewAltitude: 2.5,
      enableControls: true,
      enableAtmosphere: true,
      atmosphereColor: '#69c0ff',
      atmosphereAltitude: 0.15,
      autoRotate: false,
      autoRotateSpeed: 0.5,
      pointOfView: { lat: 0, lng: 0, altitude: 2.5 },
      ...config
    };
    
    // Event handlers
    this.eventHandlers = {
      ready: [],
      click: [],
      hover: [],
      viewChange: [],
      error: []
    };
  }

  /**
   * Initializes the 3D globe
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[GlobeRenderer] Already initialized');
      return;
    }

    if (!this.container) {
      throw new Error(`Container element with ID '${this.containerId}' not found`);
    }

    console.log('[GlobeRenderer] Initializing 3D globe...');

    try {
      // Check if Globe is available
      if (typeof Globe === 'undefined') {
        throw new Error('Globe.gl library not loaded');
      }

      // Create globe instance
      this.globe = Globe()(this.container);
      
      // Set up the globe with proper Earth appearance
      this.setupGlobe();
      
      // Configure controls
      this.setupControls();
      
      // Set initial view
      this.setInitialView();
      
      this.isInitialized = true;
      console.log('[GlobeRenderer] Globe initialized successfully');
      
      this.emit('ready', this.globe);
      
    } catch (error) {
      console.error('[GlobeRenderer] Failed to initialize globe:', error);
      throw error;
    }
  }

  /**
   * Sets up the globe with enhanced visual effects and beautiful appearance
   */
  setupGlobe() {
    console.log('[GlobeRenderer] Setting up enhanced globe...');
    
    // Set up the globe with enhanced Earth appearance
    this.globe
      // Use high-quality Earth textures
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      
      // Enhanced atmosphere with cyber glow
      .showAtmosphere(this.config.enableAtmosphere)
      .atmosphereColor('#00ffff')
      .atmosphereAltitude(0.2)
      
      // Enable smooth interactions
      .enablePointerInteraction(true)
      
      // Enhanced arc configuration (initially empty)
      .arcsData([])
      .arcColor(d => d.color || '#00ffff')
      .arcDashLength(0.3)
      .arcDashGap(0.1)
      .arcDashAnimateTime(1500)
      .arcStroke(d => d.stroke || 2)
      .arcAltitude(d => d.altitude || 0.15)
      .arcAltitudeAutoScale(0.6)
      
      // Add points for connection endpoints with glow effect
      .pointsData([])
      .pointColor(() => '#00ffff')
      .pointAltitude(0.01)
      .pointRadius(0.5)
      .pointResolution(8)
      
      // Add rings for visual enhancement
      .ringsData([])
      .ringColor(() => 'rgba(0, 255, 255, 0.3)')
      .ringMaxRadius(2)
      .ringPropagationSpeed(2)
      .ringRepeatPeriod(1000);

    // Enhanced lighting setup
    this.setupEnhancedLighting();
    
    // Add post-processing effects
    this.setupPostProcessing();
    
    console.log('[GlobeRenderer] Enhanced globe setup completed');
  }

  /**
   * Sets up enhanced lighting for better visual appeal
   */
  setupEnhancedLighting() {
    const scene = this.globe.scene();
    if (!scene) return;

    // Clear existing lights
    const lights = scene.children.filter(child => child.isLight);
    lights.forEach(light => scene.remove(light));
    
    // Enhanced ambient light with blue tint
    const ambientLight = new THREE.AmbientLight(0x404080, 0.3);
    scene.add(ambientLight);
    
    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(2, 1, 1);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    // Rim light for atmosphere effect
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.4);
    rimLight.position.set(-1, 0.5, -1);
    scene.add(rimLight);
    
    // Fill light with warm tone
    const fillLight = new THREE.DirectionalLight(0xffa500, 0.2);
    fillLight.position.set(-1, -1, 1);
    scene.add(fillLight);
    
    // Add point lights for cyber effect
    const cyberLight1 = new THREE.PointLight(0x00ffff, 0.5, 100);
    cyberLight1.position.set(0, 0, 50);
    scene.add(cyberLight1);
    
    const cyberLight2 = new THREE.PointLight(0xff00ff, 0.3, 100);
    cyberLight2.position.set(50, 0, 0);
    scene.add(cyberLight2);
  }

  /**
   * Sets up post-processing effects for enhanced visuals
   */
  setupPostProcessing() {
    const scene = this.globe.scene();
    const renderer = this.globe.renderer();
    
    if (!scene || !renderer) return;

    try {
      // Enable tone mapping for better color rendering
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      
      // Enable anti-aliasing
      renderer.antialias = true;
      
      // Enable shadows for depth
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Set clear color to deep space black
      renderer.setClearColor(0x000000, 1);
      
      console.log('[GlobeRenderer] Post-processing effects enabled');
    } catch (error) {
      console.warn('[GlobeRenderer] Could not enable post-processing:', error);
    }
  }

  /**
   * Sets up globe controls
   */
  setupControls() {
    const controls = this.globe.controls();
    
    if (controls && this.config.enableControls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = false;
      
      // Set zoom limits
      controls.minDistance = 101;
      controls.maxDistance = 1000;
      
      // Auto-rotate if enabled
      if (this.config.autoRotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = this.config.autoRotateSpeed;
      }
    }
  }

  /**
   * Sets the initial view
   */
  setInitialView() {
    this.globe.pointOfView(this.config.pointOfView, 0);
  }

  /**
   * Sets the globe's point of view
   */
  setPointOfView(pov, duration = 1000) {
    if (!this.isInitialized) {
      console.warn('[GlobeRenderer] Globe not initialized');
      return;
    }

    const viewConfig = {
      lat: pov.lat || 0,
      lng: pov.lng || pov.lon || 0,
      altitude: pov.altitude || this.config.defaultViewAltitude
    };

    console.log(`[GlobeRenderer] Setting view to: ${viewConfig.lat.toFixed(2)}, ${viewConfig.lng.toFixed(2)}`);
    
    this.globe.pointOfView(viewConfig, duration);
    this.emit('viewChange', viewConfig);
  }

  /**
   * Centers the globe on a specific location
   */
  centerOnLocation(lat, lng, altitude = this.config.defaultViewAltitude, duration = 1000) {
    this.setPointOfView({ lat, lng, altitude }, duration);
  }

  /**
   * Gets the current point of view
   */
  getPointOfView() {
    if (!this.isInitialized) {
      return null;
    }
    return this.globe.pointOfView();
  }

  /**
   * Adds an event listener
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    } else {
      console.warn(`[GlobeRenderer] Unknown event: ${event}`);
    }
  }

  /**
   * Removes an event listener
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
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[GlobeRenderer] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Gets renderer status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      containerId: this.containerId,
      config: { ...this.config },
      currentView: this.getPointOfView(),
      hasContainer: !!this.container,
      containerSize: this.container ? {
        width: this.container.clientWidth,
        height: this.container.clientHeight
      } : null
    };
  }

  /**
   * Destroys the globe and cleans up resources
   */
  destroy() {
    console.log('[GlobeRenderer] Destroying globe...');
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Reset state
    this.globe = null;
    this.isInitialized = false;
    
    console.log('[GlobeRenderer] Globe destroyed');
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobeRenderer;
} else if (typeof window !== 'undefined') {
  window.GlobeRenderer = GlobeRenderer;
}