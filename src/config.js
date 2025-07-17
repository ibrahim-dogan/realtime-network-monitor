// Configuration constants for the Live Traffic Globe system

const CONFIG = {
  // WebSocket server configuration
  WEBSOCKET_PORT: 8080,
  
  // Geolocation API configuration
  GEOLOCATION_API_URL: 'http://ip-api.com/json/',
  GEOLOCATION_RATE_LIMIT_DELAY: 250, // Minimum delay between requests (ms)
  GEOLOCATION_MAX_RETRIES: 3,
  GEOLOCATION_RETRY_BASE_DELAY: 1000, // Base delay for exponential backoff (ms)
  GEOLOCATION_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  GEOLOCATION_CACHE_FILE: '.cache/geolocation.json',
  GEOLOCATION_MAX_CONCURRENT_REQUESTS: 5,
  
  // Traffic monitoring configuration
  MAX_ARCS_RETAINED: 50,
  NETTOP_ARGS: ['-L', '0', '-x', '-J', 'bytes_out'],
  
  // IP filtering rules
  IP_FILTER_RULES: [
    '192.168.',    // Private Class C
    '10.',         // Private Class A
    '172.16.',     // Private Class B (start)
    '172.17.',     // Private Class B
    '172.18.',     // Private Class B
    '172.19.',     // Private Class B
    '172.20.',     // Private Class B
    '172.21.',     // Private Class B
    '172.22.',     // Private Class B
    '172.23.',     // Private Class B
    '172.24.',     // Private Class B
    '172.25.',     // Private Class B
    '172.26.',     // Private Class B
    '172.27.',     // Private Class B
    '172.28.',     // Private Class B
    '172.29.',     // Private Class B
    '172.30.',     // Private Class B
    '172.31.',     // Private Class B (end)
    '127.',        // Loopback
    '169.254.',    // Link-local
    '224.',        // Multicast (start)
    '225.',        // Multicast
    '226.',        // Multicast
    '227.',        // Multicast
    '228.',        // Multicast
    '229.',        // Multicast
    '230.',        // Multicast
    '231.',        // Multicast
    '232.',        // Multicast
    '233.',        // Multicast
    '234.',        // Multicast
    '235.',        // Multicast
    '236.',        // Multicast
    '237.',        // Multicast
    '238.',        // Multicast
    '239.'         // Multicast (end)
  ],
  
  // Frontend configuration
  FRONTEND: {
    WEBSOCKET_URL: 'ws://localhost:8080',
    GLOBE_IMAGE_URL: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    ARC_ANIMATION_DURATION: 1500,
    MAX_ARCS_DISPLAYED: 20,
    DEFAULT_VIEW_ALTITUDE: 2.5
  }
};

module.exports = CONFIG;