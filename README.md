# Bouncy Bill - Multiplayer Game

A two-player online action game built with JavaScript, HTML5 Canvas, and WebSockets. Players control oval characters that launch themselves by timing an oscillating arrow. The goal is to land on the opponent's head before they land on yours.

## Features

- **Real-time Multiplayer**: Play with friends anywhere in the world via WebSocket connections
- **Room System**: Create or join rooms with a 6-character room code
- **Physics-based Gameplay**: Smooth bouncing mechanics with gravity and collision detection
- **Synchronized State**: Server-authoritative game state ensures fair play across global connections
- **Win Detection**: Instant win detection when a player lands on their opponent's head

## Installation

1. Install Node.js (v14 or higher)

2. Install dependencies:
```bash
npm install
```

## Running the Game

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. To play with a friend:
   - One player clicks "Create Room" and shares the room code
   - The other player clicks "Join Room" and enters the code
   - Once both players are connected, the game starts automatically

## How to Play

1. **Wait for the countdown** (3, 2, 1, Bounce!)
2. **Watch the arrow** oscillate left and right
3. **Press SPACEBAR** when the arrow points in your desired direction
4. **Launch** and try to land on your opponent's head
5. **First to land on opponent's head wins!**

## Game Mechanics

- **Arrow Oscillation**: The arrow continuously oscillates when you're on the ground
- **Bounce Power**: Fixed launch power in the direction the arrow is pointing
- **No Midair Steering**: Once launched, you follow a physics-based arc
- **Ground Landing**: After landing, the arrow resumes oscillating
- **Win Condition**: Bottom of your oval must collide with the top of opponent's oval

## Technical Details

### Server
- Node.js with WebSocket (ws library)
- Room management system
- Authoritative collision detection
- Real-time state synchronization

### Client
- HTML5 Canvas for rendering
- Custom physics engine
- WebSocket client for networking
- Smooth interpolation for remote players

### Network Architecture
- WebSocket for bidirectional communication
- Event-based synchronization
- Server-authoritative game state
- Latency compensation with client-side prediction

## Project Structure

```
BouncyBob/
├── server/
│   └── index.js          # WebSocket server and room management
├── client/
│   ├── index.html        # Main HTML file
│   ├── styles.css        # Styling
│   ├── app.js            # Application controller
│   ├── game.js           # Game engine and physics
│   └── network.js        # WebSocket client
├── package.json          # Dependencies
└── README.md            # This file
```

## Development

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Browser Compatibility

Works best in modern browsers that support:
- WebSocket API
- HTML5 Canvas
- ES6 JavaScript features

Tested on Chrome, Firefox, Edge, and Safari.

## License

MIT

