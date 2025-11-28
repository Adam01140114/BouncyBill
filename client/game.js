// Game engine for Bouncy Bill
class Game {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.network = networkManager;

        this.players = new Map();
        this.localPlayerId = null;
        this.gameStarted = false;
        this.countdown = null;
        this.winner = null;

        // Physics constants
        this.GRAVITY = 0.5;
        this.BOUNCE_POWER = 9.6; // 20% less than 12
        this.ARROW_OSCILLATION_SPEED = 0.036; // 20% faster than 0.03
        this.ARROW_OSCILLATION_RANGE = Math.PI; // 180 degrees (0 to 180)
        this.MOVE_SPEED = 3; // Horizontal movement speed
        this.UPWARD_BOOST_MULTIPLIER = 1.5; // Exaggerate upward component of bounce

        // Ground level
        this.GROUND_Y = 550;
        this.ARENA_WIDTH = 800;
        this.ARENA_HEIGHT = 600;

        // Arrow oscillation
        this.arrowPhase = 0;

        // Input handling
        this.keys = {};
        this.setupInput();

        // Animation loop
        this.lastTime = 0;
        this.animationFrameId = null;
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.gameStarted && !this.winner) {
                e.preventDefault();
                this.handleBounce();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    handleMovement() {
        if (!this.gameStarted || this.winner) return;
        
        const player = this.players.get(this.localPlayerId);
        if (!player) return;

        // A key for left, D key for right
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            player.velocity.x = -this.MOVE_SPEED;
        } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            player.velocity.x = this.MOVE_SPEED;
        }
        // If neither key is pressed and player is grounded, let friction handle it
        // If in air, maintain current velocity (no air control damping)
    }

    addPlayer(playerId, side, position) {
        const initialPosition = position || { 
            x: side === 'left' ? 150 : 650, 
            y: this.GROUND_Y - 25 // Center of oval (ovalHeight/2 = 25)
        };

        // Start arrow phase so arrow points straight up (90°) initially
        // With new range (45-135), we need phase where normalized = 0.5 (middle of range)
        // (1 - cos(phase)) / 2 = 0.5 => cos(phase) = 0 => phase = π/2
        const initialArrowPhase = Math.PI / 2;

        this.players.set(playerId, {
            id: playerId,
            side: side,
            position: initialPosition,
            velocity: { x: 0, y: 0 },
            grounded: true,
            arrowAngle: -Math.PI / 2, // Start pointing straight up (90°)
            arrowPhase: initialArrowPhase,
            miniBoostsRemaining: 3 // Track mini boosts available (limited to 3)
        });

    }

    setLocalPlayer(playerId) {
        this.localPlayerId = playerId;
    }

    updatePlayerState(playerId, state) {
        const player = this.players.get(playerId);
        if (!player) {

            return;
        }

        // Smooth interpolation for remote players
        const wasGrounded = player.grounded;
        if (playerId !== this.localPlayerId) {
            const lerp = 0.3;
            player.position.x = player.position.x + (state.position.x - player.position.x) * lerp;
            player.position.y = player.position.y + (state.position.y - player.position.y) * lerp;
            player.velocity = state.velocity;
        } else {
            // Local player uses exact state
            player.position = state.position;
            player.velocity = state.velocity;
        }

        player.grounded = state.grounded;
        player.arrowAngle = state.arrowAngle;
        
        // Reset mini boosts if player just landed
        if (state.grounded && !wasGrounded) {
            player.miniBoostsRemaining = 3;
        }

        // Validate arrow angle is in expected range
        if (player.arrowAngle < -Math.PI || player.arrowAngle > 0) {

        }
    }

    handleBounce() {
        const player = this.players.get(this.localPlayerId);
        if (!player || this.winner) return;

        if (player.grounded) {
            // Normal bounce from ground with exaggerated upward component
            const angle = player.arrowAngle;
            const baseVelocityX = Math.cos(angle) * this.BOUNCE_POWER;
            const baseVelocityY = Math.sin(angle) * this.BOUNCE_POWER;
            
            // Only apply upward boost if angle is NOT near straight up (90°)
            // Apply boost when angle is 20° or more away from straight up
            // In canvas: -90° is straight up, so check if angle is outside -110° to -70° range
            const straightUpAngle = -Math.PI / 2; // -90 degrees
            const angleThreshold = 20 * Math.PI / 180; // 20 degrees in radians
            const isNearStraightUp = Math.abs(angle - straightUpAngle) < angleThreshold;
            
            // Exaggerate upward component only when not pointing straight up
            if (isNearStraightUp) {
                // No boost when straight up - use normal velocity
                player.velocity.x = baseVelocityX;
                player.velocity.y = baseVelocityY;
            } else {
                // Apply boost when pointing to the sides
                player.velocity.x = baseVelocityX;
                player.velocity.y = baseVelocityY * this.UPWARD_BOOST_MULTIPLIER;
            }
            
            player.grounded = false;
            player.miniBoostsRemaining = 3; // Reset boosts when bouncing from ground

            // Send bounce event to server
            this.network.sendBounce();
        } else if (player.miniBoostsRemaining > 0) {
            // Mini boost in air
            const MINI_BOOST_POWER = 7.2; // 20% more than 6
            player.velocity.y -= MINI_BOOST_POWER; // Negative y is upward in canvas
            player.miniBoostsRemaining--;

            // Send state update to sync with server
            this.network.sendStateUpdate({
                position: player.position,
                velocity: player.velocity,
                grounded: player.grounded,
                arrowAngle: player.arrowAngle
            });
        }
    }

    update(deltaTime) {
        if (!this.gameStarted || this.winner) return;

        // Handle player movement input
        this.handleMovement();

        // Update arrow oscillation for all players
        this.arrowPhase += this.ARROW_OSCILLATION_SPEED * deltaTime;

        this.players.forEach((player, playerId) => {
            // Update arrow oscillation if grounded
            if (player.grounded) {
                player.arrowPhase += this.ARROW_OSCILLATION_SPEED * deltaTime;
                // Oscillate from 20 degrees to 160 degrees
                // Use (1 - cos) / 2 to map from 0 to 1, then scale to 20° to 160°
                // Range: 20° (π/9) to 160° (8π/9) = 140° range
                // Negate to make it work with canvas coordinates (y-axis flipped)
                const normalized = (1 - Math.cos(player.arrowPhase)) / 2; // 0 to 1
                const minAngle = Math.PI / 9; // 20°
                const maxAngle = 8 * Math.PI / 9; // 160°
                const normalizedAngle = minAngle + normalized * (maxAngle - minAngle); // 20° to 160°
                player.arrowAngle = -normalizedAngle;

                // Console log for arrow angle updates
                if (playerId === this.localPlayerId && Math.floor(player.arrowPhase * 10) % 10 === 0) {

                }
            }

            // Update physics - gravity applies from game start for all players
            // Apply gravity always (ground will counteract it if player is grounded)
            if (!player.grounded) {
                player.velocity.y += this.GRAVITY * deltaTime;
            }

            // Update position for all players (grounded or not)
            player.position.x += player.velocity.x * deltaTime;
            player.position.y += player.velocity.y * deltaTime;

            // Check ground collision
            const ovalHeight = 50;
            const ovalBottom = player.position.y + ovalHeight / 2;

            if (ovalBottom >= this.GROUND_Y) {
                // Ensure player is exactly on the ground, no glitching
                player.position.y = this.GROUND_Y - ovalHeight / 2;
                player.velocity.y = 0;

                const wasGrounded = player.grounded;
                player.grounded = true;

                if (!wasGrounded) {
                    // Just landed - reset arrow to point straight up to prevent rotation glitch
                    // This ensures the oval stays upright like an egg when landing
                    player.arrowPhase = Math.PI / 2;
                    player.arrowAngle = -Math.PI / 2; // Point straight up
                    player.miniBoostsRemaining = 3; // Reset mini boosts when landing
                }

                // Apply continuous friction while grounded (only if not actively moving)
                const isMoving = (playerId === this.localPlayerId && (this.keys['KeyA'] || this.keys['KeyD'] || this.keys['ArrowLeft'] || this.keys['ArrowRight']));
                if (!isMoving) {
                    const friction = 0.95; // Higher friction to stop sliding quickly
                    player.velocity.x *= friction;
                    
                    // Stop very small velocities to prevent infinite sliding
                    if (Math.abs(player.velocity.x) < 0.1) {
                        player.velocity.x = 0;
                    }
                }
            } else {
                // Player is in the air
                player.grounded = false;
            }

            // Boundary collision (left and right walls)
            const ovalWidth = 40;
            if (player.position.x - ovalWidth / 2 < 0) {
                player.position.x = ovalWidth / 2;
                player.velocity.x *= -0.5; // Bounce off wall
            } else if (player.position.x + ovalWidth / 2 > this.ARENA_WIDTH) {
                player.position.x = this.ARENA_WIDTH - ovalWidth / 2;
                player.velocity.x *= -0.5;
            }

            // Send state update for local player
            if (playerId === this.localPlayerId) {
                this.network.sendStateUpdate({
                    position: player.position,
                    velocity: player.velocity,
                    grounded: player.grounded,
                    arrowAngle: player.arrowAngle
                });
            }
        });

        // Player-to-player collision detection (after all individual updates)
        const playersArray = Array.from(this.players.values());
        if (playersArray.length === 2) {
            const p1 = playersArray[0];
            const p2 = playersArray[1];
            const ovalWidth = 40;

            // Calculate distance between players
            const dx = p2.position.x - p1.position.x;
            const dy = p2.position.y - p1.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = ovalWidth; // Minimum distance to prevent overlap

            if (distance < minDistance && distance > 0) {
                // Players are colliding, push them apart
                const overlap = minDistance - distance;
                const separationX = (dx / distance) * overlap * 0.5;
                const separationY = (dy / distance) * overlap * 0.5;

                // Push players apart
                p1.position.x -= separationX;
                p1.position.y -= separationY;
                p2.position.x += separationX;
                p2.position.y += separationY;

                // Apply collision response - reduce velocity and push apart
                const relativeVelX = p2.velocity.x - p1.velocity.x;
                const relativeVelY = p2.velocity.y - p1.velocity.y;
                const dotProduct = relativeVelX * (dx / distance) + relativeVelY * (dy / distance);

                if (dotProduct < 0) {
                    // Players are moving towards each other
                    const collisionResponse = 0.5; // Bounce factor
                    const impulse = dotProduct * collisionResponse;

                    p1.velocity.x += (dx / distance) * impulse;
                    p1.velocity.y += (dy / distance) * impulse;
                    p2.velocity.x -= (dx / distance) * impulse;
                    p2.velocity.y -= (dy / distance) * impulse;
                }
            }
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ground
        this.ctx.fillStyle = '#0f3460';
        this.ctx.fillRect(0, this.GROUND_Y, this.canvas.width, this.canvas.height - this.GROUND_Y);

        // Draw center line
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();

        // Draw players
        this.players.forEach((player) => {
            this.drawPlayer(player);
        });
    }

    drawPlayer(player) {
        const { position, arrowAngle, grounded, side } = player;
        const ovalWidth = 40;
        const ovalHeight = 50;

        // Console logs for debugging

        // Ensure position is always valid (correct any glitches)
        if (isNaN(position.x) || isNaN(position.y)) {

            position.x = side === 'left' ? 150 : 650;
            position.y = this.GROUND_Y - ovalHeight / 2;
        }

        // Save context
        this.ctx.save();

        // Draw oval (player body) - always draw from exact position
        this.ctx.translate(position.x, position.y);

        // Tilt oval to match arrow direction when grounded
        // When arrow is at -90° (straight up), oval should have 0° rotation (upright)
        // When arrow is at 0° (right), oval should tilt right
        // When arrow is at -180° (left), oval should tilt left
        if (grounded) {
            // Calculate tilt relative to straight up position
            // arrowAngle ranges from 0° (right) to -180° (left), with -90° being straight up
            // When arrow is at -90° (straight up), tilt should be 0° (upright)
            // So: tilt = arrowAngle - (-90°) = arrowAngle + 90°
            const straightUpAngle = -Math.PI / 2;
            const tilt = arrowAngle - straightUpAngle;

            this.ctx.rotate(tilt);
        }

        // Draw oval body
        this.ctx.fillStyle = side === 'left' ? '#4ecdc4' : '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, ovalWidth / 2, ovalHeight / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw outline
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw internal lines to show rotation
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;

        // Draw a cross pattern inside the oval
        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(-ovalWidth / 3, 0);
        this.ctx.lineTo(ovalWidth / 3, 0);
        this.ctx.stroke();

        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(0, -ovalHeight / 3);
        this.ctx.lineTo(0, ovalHeight / 3);
        this.ctx.stroke();

        // Draw a small circle in the center for additional reference
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw hitboxes - head (top) and butt (bottom)
        const hitboxWidth = ovalWidth * 0.8; // Slightly smaller than oval width
        const hitboxHeight = ovalHeight * 0.2; // Small hitbox area

        // Head hitbox (top of oval)
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // Green for head
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-hitboxWidth / 2, -ovalHeight / 2, hitboxWidth, hitboxHeight);

        // Butt hitbox (bottom of oval)
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red for butt
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-hitboxWidth / 2, ovalHeight / 2 - hitboxHeight, hitboxWidth, hitboxHeight);

        // Draw arrow when grounded
        if (grounded) {
            this.ctx.restore();
            this.ctx.save();

            // Calculate arrow start position at the edge of the oval (ellipse)
            // Find the point on the ellipse perimeter in the direction of the arrow
            const a = ovalWidth / 2;  // horizontal radius
            const b = ovalHeight / 2;  // vertical radius
            // For an ellipse, the point on the perimeter at angle theta is:
            // x = a * cos(theta), y = b * sin(theta)
            const edgeX = a * Math.cos(arrowAngle);
            const edgeY = b * Math.sin(arrowAngle);

            this.ctx.translate(position.x + edgeX, position.y + edgeY);
            this.ctx.rotate(arrowAngle);

            // Draw arrow
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(60, 0);
            this.ctx.stroke();

            // Arrowhead
            this.ctx.beginPath();
            this.ctx.moveTo(60, 0);
            this.ctx.lineTo(50, -8);
            this.ctx.lineTo(50, 8);
            this.ctx.closePath();
            this.ctx.fillStyle = 'white';
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    start() {
        const animate = (currentTime) => {
            const deltaTime = Math.min((currentTime - this.lastTime) / 16.67, 2); // Cap at 2x normal speed
            this.lastTime = currentTime;

            this.update(deltaTime);
            this.render();

            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.lastTime = performance.now();
        animate(this.lastTime);
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    reset() {
        this.players.clear();
        this.gameStarted = false;
        this.countdown = null;
        this.winner = null;
        this.arrowPhase = 0;
    }
}
