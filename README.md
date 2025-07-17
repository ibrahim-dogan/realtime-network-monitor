# Live Traffic Globe

A real-time network traffic visualization system that monitors outgoing network connections from a macOS machine and displays them as animated arcs on a 3D globe.

## Features

- Real-time network traffic monitoring using macOS `nettop`
- Geographic visualization of network destinations on a 3D globe
- WebSocket-based communication between backend and frontend
- Interactive 3D globe with animated traffic arcs
- Automatic filtering of private/local IP addresses

## Requirements

- macOS (for `nettop` network monitoring)
- Node.js 14.0.0 or higher
- Modern web browser with WebGL support

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the backend agent:
   ```bash
   npm start
   ```
   Note: You'll be prompted for your password as `nettop` requires sudo privileges.

2. Open `index.html` in your web browser

3. Allow location access when prompted for optimal globe positioning

4. Watch as your network traffic is visualized in real-time!

## Project Structure

```
live-traffic-globe/
├── src/
│   ├── config.js          # Configuration constants
│   ├── utils/             # Utility classes
│   ├── services/          # Service classes
│   └── tests/             # Unit tests
├── agent.js               # Main backend agent
├── index.html             # Frontend visualization
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## Development

Run in development mode with auto-restart:
```bash
npm run dev
```

Run tests:
```bash
npm test
```