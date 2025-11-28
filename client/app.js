// Main application controller
const networkManager = new NetworkManager();
let game = null;

// DOM elements
const menuScreen = document.getElementById('menuScreen');
const createRoomScreen = document.getElementById('createRoomScreen');
const joinRoomScreen = document.getElementById('joinRoomScreen');
const gameScreen = document.getElementById('gameScreen');
const gameCanvas = document.getElementById('gameCanvas');

const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const joinRoomSubmitBtn = document.getElementById('joinRoomSubmitBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const waitingText = document.getElementById('waitingText');
const joinError = document.getElementById('joinError');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitRoomBtn = document.getElementById('exitRoomBtn');

// Screen management
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Initialize network
networkManager.connect();

// Network message handlers
networkManager.on('roomCreated', (data) => {
    networkManager.playerId = data.playerId;
    networkManager.roomId = data.roomId;
    roomCodeDisplay.textContent = data.roomId;
    showScreen(createRoomScreen);

    // Auto-copy room code to clipboard
    navigator.clipboard.writeText(data.roomId).then(() => {
        copyRoomCodeBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyRoomCodeBtn.textContent = 'Copy';
        }, 2000);
    }).catch(err => {
        // Silent fail - user can still copy manually
    });
});

networkManager.on('joinError', (data) => {
    joinError.textContent = data.message;
    setTimeout(() => {
        joinError.textContent = '';
    }, 3000);
});

networkManager.on('roomJoined', (data) => {
    networkManager.playerId = data.playerId;
    networkManager.roomId = data.roomId;
    showScreen(createRoomScreen);
    waitingText.textContent = 'Waiting for game to start...';
});

networkManager.on('playerJoined', (data) => {
    if (createRoomScreen.classList.contains('active')) {
        waitingText.textContent = 'Player B joined! Starting game...';
    }
});

networkManager.on('gameStart', (data) => {
    showScreen(gameScreen);

    // Initialize game
    if (!game) {
        game = new Game(gameCanvas, networkManager);
        game.start();
    } else {
        game.reset();
    }

    // Add players and identify local player
    data.players.forEach((playerData) => {
        game.addPlayer(playerData.id, playerData.side, playerData.position);
        if (playerData.id === data.yourPlayerId) {
            game.setLocalPlayer(playerData.id);
        }
    });

    // Show countdown
    countdownOverlay.classList.remove('hidden');
    countdownText.textContent = data.countdown;
});

networkManager.on('countdown', (data) => {
    if (data.countdown > 0) {
        countdownText.textContent = data.countdown;
    } else {
        countdownText.textContent = data.message || 'Bounce!';
        setTimeout(() => {
            countdownOverlay.classList.add('hidden');
            if (game) {
                game.gameStarted = true;
            }
        }, 1000);
    }
});

networkManager.on('bounce', (data) => {
    if (game && data.playerId !== game.localPlayerId) {
        // Remote player bounced - apply server-authoritative state
        const player = game.players.get(data.playerId);
        if (player) {
            if (data.velocity) {
                player.velocity = data.velocity;
            } else {
                // Fallback to calculating from angle
                const angle = data.angle;
                player.velocity.x = Math.cos(angle) * game.BOUNCE_POWER;
                player.velocity.y = Math.sin(angle) * game.BOUNCE_POWER;
            }
            player.grounded = false;
        }
    }
});

networkManager.on('stateUpdate', (data) => {
    if (game) {
        game.updatePlayerState(data.playerId, data.state);
    }
});

networkManager.on('win', (data) => {
    if (game) {
        game.winner = data.winner;
        game.gameStarted = false;

        const isLocalWinner = data.winner === game.localPlayerId;
        winText.textContent = isLocalWinner ? 'You Win!' : 'You Lose!';
        winOverlay.classList.remove('hidden');
    }
});

networkManager.on('playerDisconnected', (data) => {
    alert('Other player disconnected. Returning to menu.');
    resetToMenu();
});

// Button handlers
createRoomBtn.addEventListener('click', () => {
    networkManager.createRoom();
});

joinRoomBtn.addEventListener('click', () => {
    showScreen(joinRoomScreen);
    roomCodeInput.focus();
});

cancelCreateBtn.addEventListener('click', () => {
    networkManager.disconnect();
    networkManager.connect();
    resetToMenu();
});

cancelJoinBtn.addEventListener('click', () => {
    showScreen(menuScreen);
    roomCodeInput.value = '';
    joinError.textContent = '';
});

joinRoomSubmitBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode.length === 6) {
        networkManager.joinRoom(roomCode);
    } else {
        joinError.textContent = 'Please enter a 6-character room code';
    }
});

roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomSubmitBtn.click();
    }
});

// Auto-join when room code is valid (6 characters)
roomCodeInput.addEventListener('input', (e) => {
    const roomCode = e.target.value.trim().toUpperCase();
    // Only allow alphanumeric characters
    const filteredCode = roomCode.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    e.target.value = filteredCode;

    // Auto-join when 6 characters are entered
    if (filteredCode.length === 6) {

        networkManager.joinRoom(filteredCode);
    }
});

copyRoomCodeBtn.addEventListener('click', () => {
    const roomCode = roomCodeDisplay.textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        copyRoomCodeBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyRoomCodeBtn.textContent = 'Copy';
        }, 2000);
    });
});

playAgainBtn.addEventListener('click', () => {
    winOverlay.classList.add('hidden');
    networkManager.playAgain();
});

exitRoomBtn.addEventListener('click', () => {
    networkManager.disconnect();
    if (game) {
        game.stop();
        game = null;
    }
    resetToMenu();
});

function resetToMenu() {
    showScreen(menuScreen);
    if (game) {
        game.stop();
        game.reset();
    }
    roomCodeInput.value = '';
    joinError.textContent = '';
    waitingText.textContent = 'Waiting for Player B...';
    countdownOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    networkManager.connect();
}
