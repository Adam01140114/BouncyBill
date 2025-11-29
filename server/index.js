const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Serve static files from client directory
  let filePath = path.join(__dirname, '..', 'client', req.url === '/' ? 'index.html' : req.url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, '..', 'client'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
  }[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Room management
const rooms = new Map(); // roomId -> Room
const players = new Map(); // ws -> Player

class Room {
  constructor(id, host) {
    this.id = id;
    this.host = host;
    this.players = new Map(); // playerId -> PlayerData
    this.gameState = null;
    this.countdown = null;
    this.winner = null;
    this.headBounceCooldowns = new Map(); // playerId -> timestamp when next bounce allowed
    this.headContactStates = new Map(); // playerId -> Set of playerIds they're currently in head contact with
    this.scores = new Map(); // playerId -> score
    this.timerEnd = null; // timestamp when timer expires
    this.MATCH_DURATION_MS = 60000; // 1 minute
    this.customLevel = null; // Custom level data if room was created with a level
  }

  addPlayer(playerId, ws) {
    this.players.set(playerId, {
      id: playerId,
      ws: ws,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      grounded: true,
      arrowAngle: 0,
      side: this.players.size === 0 ? 'left' : 'right'
    });
    // Initialize score
    this.scores.set(playerId, 0);
    return this.players.size === 2;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.headBounceCooldowns.delete(playerId);
    this.headContactStates.delete(playerId);
    this.scores.delete(playerId);
    // Remove this player from other players' contact states
    this.headContactStates.forEach((contactSet) => {
      contactSet.delete(playerId);
    });
  }

  isEmpty() {
    return this.players.size === 0;
  }

  broadcast(message, excludePlayerId = null) {
    this.players.forEach((player, id) => {
      if (id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }

  startGame() {
    if (this.players.size !== 2) return;

    const playersArray = Array.from(this.players.values());
    const arenaWidth = 800;
    const spawnY = 400;

    // Set initial positions
    playersArray[0].position = { x: 150, y: spawnY };
    playersArray[1].position = { x: 650, y: spawnY };
    playersArray[0].velocity = { x: 0, y: 0 };
    playersArray[1].velocity = { x: 0, y: 0 };
    playersArray[0].grounded = true;
    playersArray[1].grounded = true;
    playersArray[0].arrowAngle = 0;
    playersArray[1].arrowAngle = 0;

    this.gameState = {
      started: false,
      countdown: 3
    };
    
    // Reset scores and timer
    this.scores.forEach((score, playerId) => {
      this.scores.set(playerId, 0);
    });
    this.timerEnd = null;
    this.winner = null;

    // Start countdown
    this.countdown = 3;
    this.players.forEach((player, playerId) => {
      player.ws.send(JSON.stringify({
        type: 'gameStart',
        countdown: this.countdown,
        yourPlayerId: playerId,
        players: playersArray.map(p => ({
          id: p.id,
          position: p.position,
          velocity: p.velocity,
          grounded: p.grounded,
          arrowAngle: p.arrowAngle,
          side: p.side
        })),
        scores: Array.from(this.scores.entries()).map(([id, score]) => ({ id, score })),
        matchDuration: this.MATCH_DURATION_MS,
        customLevel: this.customLevel
      }));
    });

    // Countdown sequence
    const countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown > 0) {
        this.broadcast({
          type: 'countdown',
          countdown: this.countdown
        });
      } else if (this.countdown === 0) {
        this.broadcast({
          type: 'countdown',
          countdown: 0,
          message: 'Bounce!'
        });
        this.gameState.started = true;
        this.timerEnd = Date.now() + this.MATCH_DURATION_MS;
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  updatePlayerState(playerId, state) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.position = state.position || player.position;
    player.velocity = state.velocity || player.velocity;
    player.grounded = state.grounded !== undefined ? state.grounded : player.grounded;
    player.arrowAngle = state.arrowAngle !== undefined ? state.arrowAngle : player.arrowAngle;

    // Broadcast to other player
    this.broadcast({
      type: 'stateUpdate',
      playerId: playerId,
      state: {
        position: player.position,
        velocity: player.velocity,
        grounded: player.grounded,
        arrowAngle: player.arrowAngle
      }
    }, playerId);
  }

  checkCollisions() {
    if (!this.gameState || !this.gameState.started || this.winner) return;

    const playersArray = Array.from(this.players.values());
    if (playersArray.length !== 2) return;

    const p1 = playersArray[0];
    const p2 = playersArray[1];

    // Oval dimensions
    const ovalWidth = 40;
    const ovalHeight = 50;

    // Calculate hitbox positions
    const p1Bottom = p1.position.y + ovalHeight / 2;
    const p1Top = p1.position.y - ovalHeight / 2;
    const p2Bottom = p2.position.y + ovalHeight / 2;
    const p2Top = p2.position.y - ovalHeight / 2;

    const p1Left = p1.position.x - ovalWidth / 2;
    const p1Right = p1.position.x + ovalWidth / 2;
    const p2Left = p2.position.x - ovalWidth / 2;
    const p2Right = p2.position.x + ovalWidth / 2;

    // Horizontal overlap check
    const horizontalOverlap = !(p1Right < p2Left || p1Left > p2Right);

    if (horizontalOverlap) {
      // Determine which player is on top (lower y position = higher on screen)
      const p1IsOnTop = p1.position.y < p2.position.y;

      // Initialize contact states if needed
      if (!this.headContactStates.has(p1.id)) {
        this.headContactStates.set(p1.id, new Set());
      }
      if (!this.headContactStates.has(p2.id)) {
        this.headContactStates.set(p2.id, new Set());
      }
      
      const p1Contacts = this.headContactStates.get(p1.id);
      const p2Contacts = this.headContactStates.get(p2.id);

      if (p1IsOnTop) {
        // p1 is on top, check if p1's bottom (butt) hits p2's top (head)
        const verticalDistance = p1Bottom - p2Top;
        const isInContact = verticalDistance >= 0 && verticalDistance < 10;
        
        console.log(`[checkCollisions] p1 on top - verticalDistance: ${verticalDistance.toFixed(2)}, isInContact: ${isInContact}, p1Contacts.has(p2): ${p1Contacts.has(p2.id)}`);
        
        if (isInContact) {
          // Check if this is a NEW contact (not already registered)
          const isNewContact = !p1Contacts.has(p2.id);
          
          console.log(`[checkCollisions] p1->p2 contact - isNewContact: ${isNewContact}`);
          
          if (isNewContact) {
            // Mark as in contact
            p1Contacts.add(p2.id);
            p2Contacts.add(p1.id);
            console.log(`[checkCollisions] NEW CONTACT: p1->p2, marking as in contact`);
            
            // Check cooldown
            const now = Date.now();
            const nextAllowed = this.headBounceCooldowns.get(p1.id) || 0;
            const cooldownRemaining = nextAllowed - now;
            console.log(`[checkCollisions] p1 cooldown check - now: ${now}, nextAllowed: ${nextAllowed}, remaining: ${cooldownRemaining}ms`);
            
            if (now >= nextAllowed) {
              this.headBounceCooldowns.set(p1.id, now + 670);
              // Increment score
              const currentScore = this.scores.get(p1.id) || 0;
              this.scores.set(p1.id, currentScore + 1);
              console.log(`[checkCollisions] BROADCASTING headBounce: p1->p2, p1 score: ${currentScore + 1}`);
              // Notify players of head bounce (no instant win)
              this.broadcast({
                type: 'headBounce',
                attackerId: p1.id,
                targetId: p2.id
              });
              // Broadcast score update
              this.broadcast({
                type: 'scoreUpdate',
                scores: Array.from(this.scores.entries()).map(([id, score]) => ({ id, score }))
              });
            } else {
              console.log(`[checkCollisions] p1 cooldown active, skipping headBounce`);
            }
          } else {
            console.log(`[checkCollisions] p1->p2 already in contact, skipping`);
          }
        } else {
          // No longer in contact - remove from contact states
          if (p1Contacts.has(p2.id)) {
            console.log(`[checkCollisions] p1->p2 contact ended, clearing state`);
            p1Contacts.delete(p2.id);
            p2Contacts.delete(p1.id);
          }
        }
      } else {
        // p2 is on top, check if p2's bottom (butt) hits p1's top (head)
        const verticalDistance = p2Bottom - p1Top;
        const isInContact = verticalDistance >= 0 && verticalDistance < 10;
        
        console.log(`[checkCollisions] p2 on top - verticalDistance: ${verticalDistance.toFixed(2)}, isInContact: ${isInContact}, p2Contacts.has(p1): ${p2Contacts.has(p1.id)}`);
        
        if (isInContact) {
          // Check if this is a NEW contact (not already registered)
          const isNewContact = !p2Contacts.has(p1.id);
          
          console.log(`[checkCollisions] p2->p1 contact - isNewContact: ${isNewContact}`);
          
          if (isNewContact) {
            // Mark as in contact
            p2Contacts.add(p1.id);
            p1Contacts.add(p2.id);
            console.log(`[checkCollisions] NEW CONTACT: p2->p1, marking as in contact`);
            
            // Check cooldown
            const now = Date.now();
            const nextAllowed = this.headBounceCooldowns.get(p2.id) || 0;
            const cooldownRemaining = nextAllowed - now;
            console.log(`[checkCollisions] p2 cooldown check - now: ${now}, nextAllowed: ${nextAllowed}, remaining: ${cooldownRemaining}ms`);
            
            if (now >= nextAllowed) {
              this.headBounceCooldowns.set(p2.id, now + 670);
              // Increment score
              const currentScore = this.scores.get(p2.id) || 0;
              this.scores.set(p2.id, currentScore + 1);
              console.log(`[checkCollisions] BROADCASTING headBounce: p2->p1, p2 score: ${currentScore + 1}`);
              this.broadcast({
                type: 'headBounce',
                attackerId: p2.id,
                targetId: p1.id
              });
              // Broadcast score update
              this.broadcast({
                type: 'scoreUpdate',
                scores: Array.from(this.scores.entries()).map(([id, score]) => ({ id, score }))
              });
            } else {
              console.log(`[checkCollisions] p2 cooldown active, skipping headBounce`);
            }
          } else {
            console.log(`[checkCollisions] p2->p1 already in contact, skipping`);
          }
        } else {
          // No longer in contact - remove from contact states
          if (p2Contacts.has(p1.id)) {
            console.log(`[checkCollisions] p2->p1 contact ended, clearing state`);
            p2Contacts.delete(p1.id);
            p1Contacts.delete(p2.id);
          }
        }
      }
    } else {
      // No horizontal overlap - clear contact states
      if (this.headContactStates.has(p1.id) && this.headContactStates.get(p1.id).has(p2.id)) {
        console.log(`[checkCollisions] No horizontal overlap, clearing p1->p2 contact`);
        this.headContactStates.get(p1.id).delete(p2.id);
      }
      if (this.headContactStates.has(p2.id) && this.headContactStates.get(p2.id).has(p1.id)) {
        console.log(`[checkCollisions] No horizontal overlap, clearing p2->p1 contact`);
        this.headContactStates.get(p2.id).delete(p1.id);
      }
    }
  }

  checkTimer() {
    if (!this.gameState || !this.gameState.started || this.winner) return;
    if (!this.timerEnd) return;

    const now = Date.now();
    if (now >= this.timerEnd) {
      // Timer expired - determine winner
      this.gameState.started = false;
      const playersArray = Array.from(this.players.values());
      if (playersArray.length === 2) {
        const p1Score = this.scores.get(playersArray[0].id) || 0;
        const p2Score = this.scores.get(playersArray[1].id) || 0;
        
        let winnerId = null;
        if (p1Score > p2Score) {
          winnerId = playersArray[0].id;
        } else if (p2Score > p1Score) {
          winnerId = playersArray[1].id;
        }
        // If tie, winnerId remains null
        
        this.winner = winnerId;
        this.broadcast({
          type: 'matchEnd',
          winner: winnerId,
          scores: Array.from(this.scores.entries()).map(([id, score]) => ({ id, score })),
          isTie: winnerId === null
        });
      }
    }
  }
}

// Generate unique room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate unique player ID
function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9);
}

// Game loop for physics updates
setInterval(() => {
  rooms.forEach(room => {
    if (room.gameState && room.gameState.started && !room.winner) {
      room.checkCollisions();
    }
  });
}, 16); // ~60fps

wss.on('connection', (ws) => {
  const playerId = generatePlayerId();
  players.set(ws, { id: playerId, roomId: null });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const player = players.get(ws);
      if (!player) return;

      switch (data.type) {
        case 'createRoom':
          {
            const roomId = generateRoomId();
            const room = new Room(roomId, playerId);
            rooms.set(roomId, room);
            room.addPlayer(playerId, ws);
            player.roomId = roomId;

            ws.send(JSON.stringify({
              type: 'roomCreated',
              roomId: roomId,
              playerId: playerId
            }));
          }
          break;

        case 'createRoomWithLevel':
          {
            const roomId = generateRoomId();
            const room = new Room(roomId, playerId);
            room.customLevel = data.level; // Store custom level
            rooms.set(roomId, room);
            room.addPlayer(playerId, ws);
            player.roomId = roomId;

            ws.send(JSON.stringify({
              type: 'roomCreated',
              roomId: roomId,
              playerId: playerId,
              hasCustomLevel: true
            }));
          }
          break;

        case 'joinRoom':
          {
            const roomId = data.roomId.toUpperCase();
            const room = rooms.get(roomId);

            if (!room) {
              ws.send(JSON.stringify({
                type: 'joinError',
                message: 'Room not found'
              }));
              return;
            }

            if (room.players.size >= 2) {
              ws.send(JSON.stringify({
                type: 'joinError',
                message: 'Room is full'
              }));
              return;
            }

            const isFull = room.addPlayer(playerId, ws);
            player.roomId = roomId;

            // Notify the joining player
            ws.send(JSON.stringify({
              type: 'roomJoined',
              roomId: roomId,
              playerId: playerId
            }));

            // Notify both players
            room.broadcast({
              type: 'playerJoined',
              playerId: playerId,
              roomId: roomId
            });

            if (isFull) {
              // Start game after a short delay
              setTimeout(() => {
                room.startGame();
              }, 1000);
            }
          }
          break;

        case 'bounce':
          {
            const room = rooms.get(player.roomId);
            if (!room || !room.gameState || !room.gameState.started || room.winner) return;

            const playerData = room.players.get(playerId);
            if (!playerData || !playerData.grounded) return;

            // Update player velocity on server (authoritative)
            const BOUNCE_POWER = 12;
            playerData.velocity.x = Math.cos(playerData.arrowAngle) * BOUNCE_POWER;
            playerData.velocity.y = Math.sin(playerData.arrowAngle) * BOUNCE_POWER;
            playerData.grounded = false;

            // Broadcast bounce event with updated state
            room.broadcast({
              type: 'bounce',
              playerId: playerId,
              angle: playerData.arrowAngle,
              velocity: playerData.velocity
            });
          }
          break;

        case 'stateUpdate':
          {
            const room = rooms.get(player.roomId);
            if (!room || !room.gameState || !room.gameState.started) return;

            room.updatePlayerState(playerId, data.state);
          }
          break;

        case 'playAgain':
          {
            const room = rooms.get(player.roomId);
            if (!room) return;

            // Reset game state
            room.winner = null;
            room.gameState = null;
            room.startGame();
          }
          break;
      }
    } catch (error) {

    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (player && player.roomId) {
      const room = rooms.get(player.roomId);
      if (room) {
        room.removePlayer(player.id);
        room.broadcast({
          type: 'playerDisconnected',
          playerId: player.id
        });

        if (room.isEmpty()) {
          rooms.delete(room.id);
        }
      }
    }
    players.delete(ws);
  });

  ws.on('error', (error) => {

  });
});

server.listen(PORT, () => {

});
