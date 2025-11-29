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
        this.customLevel = null; // Custom level blocks

        // Physics constants
        this.GRAVITY = 0.5;
        this.BOUNCE_POWER = 11.25; // Maximum bounce power (reduced by 25% from 15.0)
        this.MIN_BOUNCE_POWER = 6.0; // Minimum bounce power (light tap)
        this.MAX_CHARGE_TIME = 670; // Maximum charge time in milliseconds (0.67 seconds)
        this.ARROW_OSCILLATION_SPEED = 0.036; // 20% faster than 0.03
        this.ARROW_OSCILLATION_RANGE = Math.PI; // 180 degrees (0 to 180)
        this.MOVE_SPEED = 3; // Horizontal movement speed
        this.UPWARD_BOOST_MULTIPLIER = 1.5; // Exaggerate upward component of bounce
        this.MINI_BOOST_POWER = 10.21; // Power of mini boosts (9.28 * 1.1 = 10.21, increased by 10%)

        // Ground level
        this.GROUND_Y = 550;
        this.ARENA_WIDTH = 800;
        this.ARENA_HEIGHT = 600;

        // Arrow oscillation
        this.arrowPhase = 0;

        // Input handling
        this.keys = {};
        this.spaceChargeStartTime = null; // Track when space key was pressed for charging
        this.setupInput();

        // Animation loop
        this.lastTime = 0;
        this.animationFrameId = null;
    }

    setupInput() {
        // Keyboard input
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.gameStarted && !this.winner) {
                e.preventDefault();
                this.startBounceCharge();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space' && this.gameStarted && !this.winner) {
                e.preventDefault();
                this.endBounceCharge();
            }
        });

        // Mouse input
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.gameStarted && !this.winner) {
                e.preventDefault();
                this.startBounceCharge();
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.gameStarted && !this.winner) {
                e.preventDefault();
                this.endBounceCharge();
            }
        });

        // Touch input for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameStarted && !this.winner) {
                e.preventDefault();
                this.startBounceCharge();
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            if (this.gameStarted && !this.winner) {
                e.preventDefault();
                this.endBounceCharge();
            }
        });

        // Prevent context menu on long press (mobile)
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    startBounceCharge() {
        // Start charging the bounce
        if (this.spaceChargeStartTime === null) {
            this.spaceChargeStartTime = Date.now();
        }
        // Enter active bouncing mode (arrow appears and oscillates 20-160°)
        const player = this.players.get(this.localPlayerId);
        if (player && player.grounded && !player.arrowActiveMode) {
            // Seamless transition: continue from current dormant angle
            // Get current angle in dormant mode (50-130°)
            const currentDormantNormalized = (1 - Math.cos(player.arrowPhase)) / 2; // 0 to 1
            const dormantMin = 5 * Math.PI / 18; // 50°
            const dormantMax = 13 * Math.PI / 18; // 130°
            const currentDormantAngle = dormantMin + currentDormantNormalized * (dormantMax - dormantMin);

            // Active mode range (20-160°)
            const activeMin = Math.PI / 9; // 20°
            const activeMax = 8 * Math.PI / 9; // 160°

            // Find what normalized value in active mode produces the current angle
            const targetNormalized = (currentDormantAngle - activeMin) / (activeMax - activeMin);

            // Now find the phase that produces this normalized value in active mode
            const cosValue = 1 - 2 * targetNormalized;
            let newPhase = Math.acos(Math.max(-1, Math.min(1, cosValue)));

            // For active mode, phase should be in [0, π] range (maps to 20° to 160°)
            newPhase = Math.max(0, Math.min(Math.PI, newPhase));

            player.arrowPhase = newPhase;
            player.arrowActiveMode = true;
            // Initialize phase velocity based on direction
            player.arrowPhaseVelocity = player.arrowOscillationDirection === 1 ? 1 : -1;
        } else if (player && player.grounded) {
            // Already in active mode, just ensure it stays active
            player.arrowActiveMode = true;
        }
    }

    endBounceCharge() {
        // Execute bounce when released, with strength based on charge time
        if (this.spaceChargeStartTime !== null) {
            this.handleBounce();
            this.spaceChargeStartTime = null; // Reset charge
        }
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
            grounded: false, // Start ungrounded so gravity applies immediately from game start
            arrowAngle: -Math.PI / 2, // Start pointing straight up (90°)
            arrowPhase: initialArrowPhase,
            miniBoostsRemaining: 3, // Track mini boosts available (limited to 3)
            arrowFrozenUntil: 0, // Timestamp until which arrow oscillation is frozen
            arrowActiveMode: false, // false = dormant (50-130°), true = active (20-160°)
            arrowOscillationDirection: 1, // 1 = right (90→160), -1 = left (90→20)
            arrowPhaseVelocity: 1, // 1 = increasing phase, -1 = decreasing phase (for oscillation)
            dormantLandingTime: 0, // Timestamp when player entered dormant state (for debug logging)
            lastDormantLogTime: 0, // Last time we logged dormant angle (to log every 0.33s)
            headBounceTime: 0, // Timestamp when player last bounced on head (for debug logging)
            lastHeadBounceLogTime: 0, // Last time we logged head bounce velocity (to log every 0.2s)
            lastHeadBounceBoostApplied: 0 // Timestamp when head bounce boost was last applied (internal cooldown)
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

        // Calculate bounce strength based on charge time
        let bounceStrength = this.MIN_BOUNCE_POWER; // Default to minimum
        if (this.spaceChargeStartTime !== null) {
            const chargeTime = Date.now() - this.spaceChargeStartTime;
            const chargeRatio = Math.min(chargeTime / this.MAX_CHARGE_TIME, 1.0); // Clamp to 0-1
            // Interpolate between min and max bounce power based on charge
            bounceStrength = this.MIN_BOUNCE_POWER + (this.BOUNCE_POWER - this.MIN_BOUNCE_POWER) * chargeRatio;
        }

        if (player.grounded) {
            // Normal bounce from ground with exaggerated upward component
            const angle = player.arrowAngle;
            const baseVelocityX = Math.cos(angle) * bounceStrength;
            const baseVelocityY = Math.sin(angle) * bounceStrength;

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
            // Mini boost in air - also use charge system
            // Scale mini boost power based on charge (but keep it smaller than ground bounce)
            const miniBoostStrength = this.MINI_BOOST_POWER * (bounceStrength / this.BOUNCE_POWER);
            player.velocity.y -= miniBoostStrength; // Negative y is upward in canvas
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

    applyHeadBounceBoost(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Internal cooldown check to prevent duplicate boosts
        // This is a safety measure in case the function is called multiple times
        const now = Date.now();
        const timeSinceLastBoost = now - (player.lastHeadBounceBoostApplied || 0);
        const COOLDOWN_MS = 670; // Same as server-side cooldown
        
        if (timeSinceLastBoost < COOLDOWN_MS) {
            console.log(`[HEAD BOUNCE] Player ${playerId}: Boost blocked by internal cooldown (${timeSinceLastBoost.toFixed(0)}ms since last boost, need ${COOLDOWN_MS}ms)`);
            return; // Skip applying boost if still in cooldown
        }

        // Track head bounce time for debug logging
        player.headBounceTime = Date.now();
        player.lastHeadBounceLogTime = Date.now();
        player.lastHeadBounceBoostApplied = now; // Update cooldown timestamp
        
        // Store velocity before boost for debugging
        const velocityBeforeBoost = player.velocity.y;
        
        // Apply one upward boost to simulate bouncing off opponent
        // Head bounce boost is double the strength of regular mini boost, plus 10%
        const boostAmount = this.MINI_BOOST_POWER * 2.2;
        
        // Calculate new velocity
        const newVelocityY = player.velocity.y - boostAmount;
        
        // Apply the boost (velocity cap will be enforced in update loop for 1 second)
        player.velocity.y = newVelocityY;
        
        // Cap immediately to -10 if it exceeds
        const MAX_UPWARD_VELOCITY = -10;
        if (player.velocity.y < MAX_UPWARD_VELOCITY) {
            player.velocity.y = MAX_UPWARD_VELOCITY;
            console.log(`[HEAD BOUNCE] Player ${playerId}: Velocity capped at ${MAX_UPWARD_VELOCITY.toFixed(2)} (was ${velocityBeforeBoost.toFixed(2)}, boost was ${boostAmount.toFixed(2)})`);
        } else {
            console.log(`[HEAD BOUNCE] Player ${playerId}: Applied boost of ${boostAmount.toFixed(2)}, velocity before: ${velocityBeforeBoost.toFixed(2)}, velocity after: ${player.velocity.y.toFixed(2)}`);
        }
        
        player.grounded = false;

        if (playerId === this.localPlayerId) {
            this.network.sendStateUpdate({
                position: player.position,
                velocity: player.velocity,
                grounded: player.grounded,
                arrowAngle: player.arrowAngle
            });
        }
    }

    // Freeze arrow oscillation for a player for the given duration (ms)
    freezeArrowFor(playerId, durationMs) {
        const player = this.players.get(playerId);
        if (!player) return;
        const now = Date.now();
        const until = now + durationMs;
        // If already frozen longer, keep the longer freeze
        player.arrowFrozenUntil = Math.max(player.arrowFrozenUntil || 0, until);
    }

    update(deltaTime) {
        if (!this.gameStarted || this.winner) return;

        // Handle player movement input
        this.handleMovement();

        // Update arrow oscillation for all players
        this.arrowPhase += this.ARROW_OSCILLATION_SPEED * deltaTime;

        this.players.forEach((player, playerId) => {
            // IMPORTANT: Store grounded state at the VERY START of the frame
            // This is the state from the previous frame, before any updates
            const wasGroundedAtStart = player.grounded;
            // Store velocity before collision checks (needed to determine landing direction)
            const velocityBeforeCollision = { x: player.velocity.x, y: player.velocity.y };

            // Update physics - gravity applies from game start for all players
            // Apply gravity always (ground will counteract it if player is grounded)
            if (!player.grounded) {
                player.velocity.y += this.GRAVITY * deltaTime;
            }

            // Cap upward velocity at -10 for 1 second after head bounce
            // This prevents super boosts from stacking
            const now = Date.now();
            if (player.headBounceTime) {
                const timeSinceHeadBounce = now - player.headBounceTime;
                if (timeSinceHeadBounce < 1000) { // Within 1 second of head bounce
                    const MAX_UPWARD_VELOCITY = -10; // Cap at -10 (can't go faster upward)
                    if (player.velocity.y < MAX_UPWARD_VELOCITY) {
                        player.velocity.y = MAX_UPWARD_VELOCITY;
                    }
                }
            }

            // Update position for all players (grounded or not)
            player.position.x += player.velocity.x * deltaTime;
            player.position.y += player.velocity.y * deltaTime;
            
            // Debug log: show upward velocity every 0.2 seconds for 2 seconds after head bounce
            if (player.headBounceTime && player.id === this.localPlayerId) {
                const timeSinceHeadBounce = now - player.headBounceTime;
                
                if (timeSinceHeadBounce < 2000) { // Within 2 seconds of head bounce
                    // Log every 0.2 seconds (200ms)
                    const timeSinceLastLog = now - (player.lastHeadBounceLogTime || player.headBounceTime);
                    if (timeSinceLastLog >= 200) {
                        console.log(`[HEAD BOUNCE VELOCITY] Player ${playerId}: Upward velocity = ${player.velocity.y.toFixed(2)}, Time since bounce = ${(timeSinceHeadBounce / 1000).toFixed(2)}s`);
                        player.lastHeadBounceLogTime = now;
                    }
                } else {
                    // Clear head bounce time after 2 seconds to stop logging
                    player.headBounceTime = 0;
                    player.lastHeadBounceLogTime = 0;
                }
            }

            // Check collision with custom level blocks FIRST (before ground check)
            // This prevents conflicts between block collision and ground collision
            // Use the grounded state from the start of the frame (previous frame's state)
            let isOnBlock = false;
            if (this.customLevel && this.customLevel.blocks && this.customLevel.blocks.length > 0) {
                isOnBlock = this.checkBlockCollision(player, playerId, wasGroundedAtStart, velocityBeforeCollision);
            }

            // If player was grounded on a block in previous frame but collision check says not on block,
            // they might be between blocks or collision detection is unstable - preserve grounded state
            // This prevents flickering when moving between adjacent blocks
            if (wasGroundedAtStart && !isOnBlock && this.customLevel && this.customLevel.blocks) {
                // Check if player is very close to any block (within 5 pixels)
                const editorGridSize = 20;
                const editorBlockSize = 30;
                const editorTotalSize = editorGridSize * editorBlockSize;
                const scaleX = this.canvas.width / editorTotalSize;
                const scaleY = this.canvas.height / editorTotalSize;
                const ovalHeight = 50;
                const playerBottom = player.position.y + ovalHeight / 2;

                for (const block of this.customLevel.blocks) {
                    const blockY = block.y * editorBlockSize * scaleY;
                    const blockTop = blockY;
                    const distanceToBlock = Math.abs(playerBottom - blockTop);
                    if (distanceToBlock < 5) {
                        // Player is very close to block - preserve grounded state
                        isOnBlock = true;
                        player.grounded = true;
                        break;
                    }
                }
            }

            // Check ground collision (only if not on a block)
            const ovalHeight = 50;
            const ovalBottom = player.position.y + ovalHeight / 2;

            if (!isOnBlock && ovalBottom >= this.GROUND_Y) {
                // Ensure player is exactly on the ground, no glitching
                player.position.y = this.GROUND_Y - ovalHeight / 2;
                player.velocity.y = 0;

                const wasGrounded = player.grounded;
                player.grounded = true;

                if (!wasGrounded) {
                    // Just landed - enter dormant state (arrow hidden, oscillates 50-130°)
                    player.arrowActiveMode = false;
                    player.dormantLandingTime = Date.now(); // Track landing time for debug logs

                    // Determine oscillation direction based on horizontal velocity BEFORE landing
                    // Use velocityBeforeCollision since velocity may have been reset to 0
                    // Positive velocity (moving right) = rotate 90→20 (counter-clockwise, decreasing phase)
                    // Negative velocity (moving left) = rotate 90→160 (clockwise, increasing phase)
                    const velocityDir = velocityBeforeCollision.x > 0.1 ? 'RIGHT' : (velocityBeforeCollision.x < -0.1 ? 'LEFT' : 'NONE');

                    if (velocityBeforeCollision.x > 0.1) {
                        // Moving right - rotate counter-clockwise from 90° to 50° (decrease phase)
                        player.arrowOscillationDirection = -1;
                        player.arrowPhase = Math.PI / 2;
                        player.arrowPhaseVelocity = -1; // Start decreasing towards 0 (50°)

                    } else if (velocityBeforeCollision.x < -0.1) {
                        // Moving left - rotate clockwise from 90° to 130° (increase phase)
                        player.arrowOscillationDirection = 1;
                        player.arrowPhase = Math.PI / 2;
                        player.arrowPhaseVelocity = 1; // Start increasing towards π (130°)

                    } else {
                        // No significant horizontal velocity - default to right (counter-clockwise)
                        player.arrowOscillationDirection = -1;
                        player.arrowPhase = Math.PI / 2;
                        player.arrowPhaseVelocity = -1; // Start decreasing towards 0 (50°)

                    }

                    // Reset arrow to point straight up to prevent rotation glitch
                    // This ensures the oval stays upright like an egg when landing
                    player.arrowAngle = -Math.PI / 2; // Point straight up (90°)
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
            } else if (!isOnBlock) {
                // Player is in the air (and not on a block)
                // Only set grounded to false if we're sure they're not on a block
                // (isOnBlock check already handled block collisions)
                // IMPORTANT: If player was grounded on a block in previous frame, preserve that state
                // This prevents flickering when collision detection is slightly unstable
                // Only reset to false if player was NOT grounded in previous frame
                if (!wasGroundedAtStart) {
                    player.grounded = false;
                }
                // If wasGroundedAtStart is true, keep player.grounded as is (don't reset it)
            }
            // Note: If isOnBlock is true, grounded state is set in checkBlockCollision
            // DO NOT reset grounded to false here if player is on a block!

            // Apply friction when player is on a block (same as ground)
            // This needs to be in the main update loop to ensure it runs every frame
            if (isOnBlock && player.grounded) {
                const isMoving = (playerId === this.localPlayerId && (this.keys['KeyA'] || this.keys['KeyD'] || this.keys['ArrowLeft'] || this.keys['ArrowRight']));
                if (!isMoving) {
                    const friction = 0.95; // Same friction as ground
                    player.velocity.x *= friction;

                    // Stop very small velocities to prevent infinite sliding
                    if (Math.abs(player.velocity.x) < 0.1) {
                        player.velocity.x = 0;
                    }
                } else {
                    // Even when moving, apply some friction to prevent sliding
                    // This prevents the player from sliding when they land with horizontal velocity
                    const movingFriction = 0.98; // Slight friction even when moving
                    player.velocity.x *= movingFriction;

                    // Stop very small velocities
                    if (Math.abs(player.velocity.x) < 0.05) {
                        player.velocity.x = 0;
                    }
                }
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

            // Update arrow oscillation if grounded (AFTER collision checks, so landing resets happen first)
            if (player.grounded) {
                const now = Date.now();
                // Only oscillate if not currently frozen (e.g., just got bounced on)
                if (!player.arrowFrozenUntil || now >= player.arrowFrozenUntil) {
                    // Active mode oscillates at 58.8% of original speed (49% * 1.2 = 58.8% after 20% increase)
                    // Dormant mode oscillates 10% faster than normal
                    const oscillationSpeed = player.arrowActiveMode 
                        ? this.ARROW_OSCILLATION_SPEED * 0.588  // Increased by 20% from 0.49
                        : this.ARROW_OSCILLATION_SPEED * 1.1;   // 10% faster in dormant mode

                    // Oscillate phase for active mode - full range 20° to 160°
                    if (player.arrowActiveMode) {
                        // Initialize phase velocity if not set
                        if (player.arrowPhaseVelocity === undefined) {
                            // For RIGHT: start increasing (towards 160°)
                            // For LEFT: start decreasing (towards 20°)
                            player.arrowPhaseVelocity = player.arrowOscillationDirection === 1 ? 1 : -1;
                        }

                        // Full oscillation range: phase goes from 0 to π (which maps to 20° to 160°)
                        player.arrowPhase += oscillationSpeed * deltaTime * player.arrowPhaseVelocity;

                        // Wrap at boundaries: when phase hits 0 or π, reverse direction
                        if (player.arrowPhase >= Math.PI) {
                            player.arrowPhase = Math.PI;
                            player.arrowPhaseVelocity = -1; // Reverse direction (start decreasing)
                        } else if (player.arrowPhase <= 0) {
                            player.arrowPhase = 0;
                            player.arrowPhaseVelocity = 1; // Reverse direction (start increasing)
                        }
                    } else {
                        // Dormant mode: oscillate phase from 0 to π (maps to 50° to 130°)
                        // Use arrowPhaseVelocity to control direction
                        player.arrowPhase += oscillationSpeed * deltaTime * player.arrowPhaseVelocity;

                        // Wrap at boundaries: when phase hits 0 or π, reverse direction
                        if (player.arrowPhase >= Math.PI) {
                            player.arrowPhase = Math.PI;
                            player.arrowPhaseVelocity = -1; // Reverse direction (start decreasing)
                        } else if (player.arrowPhase <= 0) {
                            player.arrowPhase = 0;
                            player.arrowPhaseVelocity = 1; // Reverse direction (start increasing)
                        }

                        // Safety clamp to ensure phase stays within bounds
                        if (player.arrowPhase > Math.PI) {
                            player.arrowPhase = Math.PI;
                        } else if (player.arrowPhase < 0) {
                            player.arrowPhase = 0;
                        }
                    }

                    if (player.arrowActiveMode) {
                        // Active bouncing mode: oscillate from 20 degrees to 160 degrees
                        // Direction determines which way it rotates from 90°
                        // Direction = 1: 90° → 160° (right/clockwise)
                        // Direction = -1: 90° → 20° (left/counter-clockwise)

                        // For active mode, phase oscillates in full 0 to π range (20° to 160°)
                        // Direction only determines initial velocity, not phase calculation
                        let effectivePhase = player.arrowPhase;

                        const normalized = (1 - Math.cos(effectivePhase)) / 2; // 0 to 1
                        const minAngle = Math.PI / 9; // 20°
                        const maxAngle = 8 * Math.PI / 9; // 160°
                        const normalizedAngle = minAngle + normalized * (maxAngle - minAngle); // 20° to 160°
                        player.arrowAngle = -normalizedAngle;

                        // Debug log occasionally to track oscillation
                        if (player.id === this.localPlayerId && Math.floor(Date.now() / 1000) % 2 === 0) {
                            const angleDeg = normalizedAngle * 180 / Math.PI;
                            const direction = player.arrowOscillationDirection === 1 ? 'RIGHT' : 'LEFT';

                        }
                    } else {
                        // Dormant state: oscillate from 50 degrees to 130 degrees
                        // Range: 50° (5π/18) to 130° (13π/18) = 80° range
                        const normalized = (1 - Math.cos(player.arrowPhase)) / 2; // 0 to 1
                        const minAngle = 5 * Math.PI / 18; // 50°
                        const maxAngle = 13 * Math.PI / 18; // 130°
                        const normalizedAngle = minAngle + normalized * (maxAngle - minAngle); // 50° to 130°
                        player.arrowAngle = -normalizedAngle;

                        // Debug log: show angle every 0.2 seconds (1/5th of a second) for 2 seconds after landing
                        if (player.dormantLandingTime && player.id === this.localPlayerId) {
                            const now = Date.now();
                            const timeSinceLanding = now - player.dormantLandingTime;

                            if (timeSinceLanding < 2000) { // Within 2 seconds of landing
                                // Log every 0.2 seconds (200ms)
                                const timeSinceLastLog = now - (player.lastDormantLogTime || player.dormantLandingTime);
                                if (timeSinceLastLog >= 200) {
                                    const angleDeg = normalizedAngle * 180 / Math.PI;
                                    const oscDir = player.arrowPhaseVelocity === -1 ? '-90' : '+90';

                                    player.lastDormantLogTime = now;
                                }
                            } else {
                                // Clear landing time after 2 seconds to stop logging
                                player.dormantLandingTime = 0;
                                player.lastDormantLogTime = 0;
                            }
                        }
                    }
                }
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

        // Draw custom level blocks if present
        if (this.customLevel && this.customLevel.blocks) {
            this.drawCustomLevel();
        }

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

    drawCustomLevel() {
        if (!this.customLevel || !this.customLevel.blocks || this.customLevel.blocks.length === 0) {
            return;
        }

        const editorGridSize = 20; // Editor is 20x20
        const editorBlockSize = 30; // Each block in editor is 30px
        const editorTotalSize = editorGridSize * editorBlockSize; // 600px

        // Scale blocks from editor coordinates to game canvas
        const scaleX = this.canvas.width / editorTotalSize;
        const scaleY = this.canvas.height / editorTotalSize;

        this.ctx.fillStyle = '#4ecdc4';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;

        this.customLevel.blocks.forEach(block => {
            const x = block.x * editorBlockSize * scaleX;
            const y = block.y * editorBlockSize * scaleY;
            const width = editorBlockSize * scaleX;
            const height = editorBlockSize * scaleY;

            this.ctx.fillRect(x, y, width, height);
            this.ctx.strokeRect(x, y, width, height);
        });
    }

    setCustomLevel(level) {
        this.customLevel = level;
    }

    checkBlockCollision(player, playerId, wasGroundedBefore, velocityBeforeCollision) {
        if (!this.customLevel || !this.customLevel.blocks) return false;

        const editorGridSize = 20;
        const editorBlockSize = 30;
        const editorTotalSize = editorGridSize * editorBlockSize;
        const scaleX = this.canvas.width / editorTotalSize;
        const scaleY = this.canvas.height / editorTotalSize;

        const ovalWidth = 40;
        const ovalHeight = 50;
        const playerLeft = player.position.x - ovalWidth / 2;
        const playerRight = player.position.x + ovalWidth / 2;
        const playerTop = player.position.y - ovalHeight / 2;
        const playerBottom = player.position.y + ovalHeight / 2;

        let isOnTopOfBlock = false;

        // Store the actual grounded state BEFORE we check any blocks
        // This is the state from the previous frame, which tells us if we're already on a block
        // Use the parameter passed in (wasGroundedBefore) which is from the start of the frame
        // This is more reliable than checking player.grounded which might have been modified
        const actuallyWasGrounded = wasGroundedBefore;

        // IMPORTANT: If player was already grounded, they should still be grounded unless we detect otherwise
        // This prevents the grounded state from being lost between frames

        // Check all blocks - but break early once we've detected the player is on top of a block
        // This prevents multiple collisions from interfering with each other
        for (const block of this.customLevel.blocks) {
            // Convert block coordinates to game canvas coordinates
            const blockX = block.x * editorBlockSize * scaleX;
            const blockY = block.y * editorBlockSize * scaleY;
            const blockWidth = editorBlockSize * scaleX;
            const blockHeight = editorBlockSize * scaleY;
            const blockLeft = blockX;
            const blockRight = blockX + blockWidth;
            const blockTop = blockY;
            const blockBottom = blockY + blockHeight;

            // Check if player overlaps with block
            if (playerRight > blockLeft && playerLeft < blockRight &&
                playerBottom > blockTop && playerTop < blockBottom) {

                // Calculate overlap amounts
                const overlapX = Math.min(playerRight - blockLeft, blockRight - playerLeft);
                const overlapY = Math.min(playerBottom - blockTop, blockBottom - playerTop);

                // Push player out in the direction of least overlap
                if (overlapX < overlapY) {
                    // Horizontal collision
                    if (player.position.x < blockLeft + blockWidth / 2) {
                        // Player is on the left side of block
                        player.position.x = blockLeft - ovalWidth / 2;
                        player.velocity.x = Math.min(0, player.velocity.x * 0.5); // Stop or reverse horizontal velocity
                    } else {
                        // Player is on the right side of block
                        player.position.x = blockRight + ovalWidth / 2;
                        player.velocity.x = Math.max(0, player.velocity.x * 0.5);
                    }
                } else {
                    // Vertical collision
                    const playerCenterY = player.position.y;
                    const blockCenterY = blockTop + blockHeight / 2;

                    if (playerCenterY < blockCenterY) {
                        // Player is above block (landing on top)
                        // Only set grounded if player is falling down (not jumping up into block)
                        if (player.velocity.y >= 0) {

                            player.position.y = blockTop - ovalHeight / 2;
                            player.velocity.y = 0;
                            player.grounded = true;
                            isOnTopOfBlock = true;

                            // Reset arrow and mini boosts ONLY when first landing on block (not every frame)
                            // Treat platforms exactly like ground - check if player was actually grounded before
                            // Use actuallyWasGrounded (captured at start of function) instead of wasGroundedBefore parameter
                            if (!actuallyWasGrounded) {
                                // FIRST LANDING on platform - enter dormant state (arrow hidden, oscillates 50-130°)
                                player.arrowActiveMode = false;
                                player.dormantLandingTime = Date.now(); // Track landing time for debug logs

                                // Determine oscillation direction based on horizontal velocity BEFORE landing
                                // Use velocityBeforeCollision since velocity may have been modified
                                const velocityDir = velocityBeforeCollision.x > 0.1 ? 'RIGHT' : (velocityBeforeCollision.x < -0.1 ? 'LEFT' : 'NONE');

                                if (velocityBeforeCollision.x > 0.1) {
                                    player.arrowOscillationDirection = -1; // Right: 90→50 (counter-clockwise)
                                    player.arrowPhase = Math.PI / 2;
                                    player.arrowPhaseVelocity = -1; // Start decreasing towards 0 (50°)

                                } else if (velocityBeforeCollision.x < -0.1) {
                                    player.arrowOscillationDirection = 1; // Left: 90→130 (clockwise)
                                    player.arrowPhase = Math.PI / 2;
                                    player.arrowPhaseVelocity = 1; // Start increasing towards π (130°)

                                } else {
                                    player.arrowOscillationDirection = -1; // Default to right (counter-clockwise)
                                    player.arrowPhase = Math.PI / 2;
                                    player.arrowPhaseVelocity = -1; // Start decreasing towards 0 (50°)

                                }

                                // Just landed - reset arrow to point straight up to prevent rotation glitch
                                // This ensures the oval stays upright like an egg when landing
                                player.arrowPhase = Math.PI / 2;
                                player.arrowAngle = -Math.PI / 2; // Point straight up
                                player.miniBoostsRemaining = 3; // Reset mini boosts when landing
                            } else {
                                // Already on platform - log if arrow phase is being reset incorrectly (bug detection)
                                if (Math.abs(player.arrowPhase - Math.PI / 2) < 0.01) {

                                }
                            }

                            // IMPORTANT: Break out of loop once we've detected player is on top of a block
                            // Friction is now applied in the main update loop to ensure it runs every frame
                            // This prevents multiple collisions from interfering with each other
                            break;
                        } else {
                            // Player is jumping up into block - push them down
                            player.position.y = blockBottom + ovalHeight / 2;
                            player.velocity.y = 0;
                        }
                    } else {
                        // Player is below block (hitting bottom)
                        player.position.y = blockBottom + ovalHeight / 2;
                        player.velocity.y = Math.max(0, player.velocity.y * 0.5); // Bounce down
                    }
                }
            }
        }

        return isOnTopOfBlock;
    }

    drawPlayer(player) {
        const { position, arrowAngle, grounded, side } = player;

        // Calculate charge progress if space is being held (for local player only)
        let chargeProgress = 0; // 0 to 1
        if (player.id === this.localPlayerId && this.spaceChargeStartTime !== null && grounded) {
            const chargeTime = Date.now() - this.spaceChargeStartTime;
            chargeProgress = Math.min(chargeTime / this.MAX_CHARGE_TIME, 1.0); // Clamp to 0-1
        }

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
        const hitboxWidth = ovalWidth * 0.8 * 1.1; // Slightly smaller than oval width, increased by 10%
        const hitboxHeight = ovalHeight * 0.2 * 1.1; // Small hitbox area, increased by 10%

        // Head hitbox (top of oval)
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // Green for head
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-hitboxWidth / 2, -ovalHeight / 2, hitboxWidth, hitboxHeight);

        // Butt hitbox (bottom of oval)
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red for butt
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-hitboxWidth / 2, ovalHeight / 2 - hitboxHeight, hitboxWidth, hitboxHeight);

        // Draw arrow when grounded AND in active mode (hidden in dormant state)
        if (grounded && player.arrowActiveMode) {
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

            // Draw arrow with charge indicator
            const arrowLength = 60;
            const isCharging = player.id === this.localPlayerId && this.spaceChargeStartTime !== null;

            if (isCharging && chargeProgress > 0) {
                // Draw charged portion (white) - fills from base to tip based on charge
                const chargedLength = arrowLength * chargeProgress;
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(chargedLength, 0);
                this.ctx.stroke();

                // Draw uncharged portion (light grey) - from charged point to tip
                if (chargeProgress < 1.0) {
                    this.ctx.strokeStyle = '#888888'; // Light grey
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.moveTo(chargedLength, 0);
                    this.ctx.lineTo(arrowLength, 0);
                    this.ctx.stroke();
                }

                // Arrowhead - white if fully charged, grey if partially charged
                this.ctx.beginPath();
                this.ctx.moveTo(arrowLength, 0);
                this.ctx.lineTo(arrowLength - 10, -8);
                this.ctx.lineTo(arrowLength - 10, 8);
                this.ctx.closePath();
                this.ctx.fillStyle = chargeProgress >= 1.0 ? 'white' : '#888888';
                this.ctx.fill();
            } else {
                // Normal arrow (white) when not charging
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(arrowLength, 0);
                this.ctx.stroke();

                // Arrowhead
                this.ctx.beginPath();
                this.ctx.moveTo(arrowLength, 0);
                this.ctx.lineTo(arrowLength - 10, -8);
                this.ctx.lineTo(arrowLength - 10, 8);
                this.ctx.closePath();
                this.ctx.fillStyle = 'white';
                this.ctx.fill();
            }
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
