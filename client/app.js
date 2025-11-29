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
const scoreLocalEl = document.getElementById('scoreLocal');
const scoreOpponentEl = document.getElementById('scoreOpponent');
const timerDisplayEl = document.getElementById('timerDisplay');
const myLevelsBtn = document.getElementById('myLevelsBtn');
const myLevelsModule = document.getElementById('myLevelsModule');
const closeLevelsBtn = document.getElementById('closeLevelsBtn');
const addLevelBtn = document.getElementById('addLevelBtn');
const levelEditorScreen = document.getElementById('levelEditorScreen');
const levelEditorCanvas = document.getElementById('levelEditorCanvas');
const submitLevelBtn = document.getElementById('submitLevelBtn');
const cancelEditorBtn = document.getElementById('cancelEditorBtn');
const authPopup = document.getElementById('authPopup');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const cancelAuthBtn = document.getElementById('cancelAuthBtn');
const authError = document.getElementById('authError');
const levelsList = document.getElementById('levelsList');

let lastHeadBounceAlertTime = 0;
let lastHeadBounceBoostTime = new Map(); // playerId -> timestamp
let scoreState = {};
let opponentPlayerId = null;
let matchTimerInterval = null;
let matchTimerEnd = null;
let pendingTimerDuration = null;
let levelEditor = null;
let userLevels = [];
let editingLevelId = null; // Track which level is being edited

// Screen management
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function setScores(scoreList = []) {
    scoreState = {};
    scoreList.forEach(({ id, score }) => {
        scoreState[id] = score;
    });
    updateScoreDisplay();
}

function updateScoreDisplay() {
    const localId = game?.localPlayerId;
    const localScore = localId ? (scoreState[localId] || 0) : 0;
    const opponentScore = opponentPlayerId ? (scoreState[opponentPlayerId] || 0) : 0;
    scoreLocalEl.textContent = localScore;
    scoreOpponentEl.textContent = opponentScore;
}

function startMatchTimer(durationMs) {
    clearMatchTimer();
    matchTimerEnd = Date.now() + durationMs;
    updateTimerDisplay();
    matchTimerInterval = setInterval(updateTimerDisplay, 100);
}

function clearMatchTimer() {
    if (matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }
    matchTimerEnd = null;
    timerDisplayEl.textContent = '01:00';
}

function updateTimerDisplay() {
    if (!matchTimerEnd) {
        timerDisplayEl.textContent = '01:00';
        return;
    }
    const remainingMs = Math.max(0, matchTimerEnd - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    timerDisplayEl.textContent = `${minutes}:${seconds}`;
    if (remainingMs <= 0) {
        clearMatchTimer();
    }
}

// Initialize network
networkManager.connect();

// Network message handlers
networkManager.on('roomCreated', (data) => {
    networkManager.playerId = data.playerId;
    networkManager.roomId = data.roomId;
    roomCodeDisplay.textContent = data.roomId;
    
    // Always show the create room screen with the room code
    showScreen(createRoomScreen);
    waitingText.textContent = 'Waiting for Player B...';
    
    // Auto-copy room code to clipboard
    navigator.clipboard.writeText(data.roomId).then(() => {
        if (copyRoomCodeBtn) {
            copyRoomCodeBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyRoomCodeBtn.textContent = 'Copy';
            }, 2000);
        }
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

    // Set custom level if present
    if (data.customLevel) {
        console.log('Setting custom level:', data.customLevel);
        game.setCustomLevel(data.customLevel);
    }

    // Add players and identify local player
    data.players.forEach((playerData) => {
        game.addPlayer(playerData.id, playerData.side, playerData.position);
        if (playerData.id === data.yourPlayerId) {
            game.setLocalPlayer(playerData.id);
        }
    });
    
    // Set up scores and opponent
    opponentPlayerId = data.players.find(p => p.id !== data.yourPlayerId)?.id || null;
    setScores(data.scores || []);

    // Show countdown
    countdownOverlay.classList.remove('hidden');
    countdownText.textContent = data.countdown;
    
    // Store match duration to start timer when countdown ends
    if (data.matchDuration) {
        pendingTimerDuration = data.matchDuration;
    }
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
            // Start timer when game actually starts
            if (pendingTimerDuration) {
                startMatchTimer(pendingTimerDuration);
                pendingTimerDuration = null;
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

networkManager.on('headBounce', (data) => {
    console.log(`[client] headBounce event received:`, data);
    if (!game) {
        console.log(`[client] No game instance, ignoring`);
        return;
    }
    
    // Apply mini boost to the attacker (with cooldown to prevent multiple boosts)
    const now = Date.now();
    const lastBoostTime = lastHeadBounceBoostTime.get(data.attackerId) || 0;
    const timeSinceLastBoost = now - lastBoostTime;
    
    if (timeSinceLastBoost >= 670) {
        // Only apply boost if cooldown has passed
        lastHeadBounceBoostTime.set(data.attackerId, now);
        console.log(`[client] Applying head bounce boost to ${data.attackerId}`);
        game.applyHeadBounceBoost(data.attackerId);
    } else {
        console.log(`[client] Boost cooldown active for ${data.attackerId}, skipping boost (${timeSinceLastBoost}ms since last)`);
    }
    
    if (game.localPlayerId === data.attackerId) {
        const timeSinceLastAlert = now - lastHeadBounceAlertTime;
        console.log(`[client] Local player is attacker, time since last alert: ${timeSinceLastAlert}ms`);
        if (timeSinceLastAlert < 670) {
            console.log(`[client] Alert cooldown active, skipping alert`);
            return;
        }
        lastHeadBounceAlertTime = now;
        console.log(`[client] Showing alert: "You bounced on their head!"`);
        alert('You bounced on their head!');
    } else {
        console.log(`[client] Local player is not attacker (attacker: ${data.attackerId}, local: ${game.localPlayerId}), ignoring`);
    }
});

networkManager.on('scoreUpdate', (data) => {
    setScores(data.scores || []);
});

networkManager.on('matchEnd', (data) => {
    if (!game) return;
    setScores(data.scores || []);
    clearMatchTimer();
    game.winner = data.winner || null;
    game.gameStarted = false;
    
    let message = '';
    if (data.isTie) {
        message = 'Tie Game!';
    } else {
        const isLocalWinner = data.winner === game.localPlayerId;
        message = isLocalWinner ? 'You Win!' : 'You Lose!';
    }
    winText.textContent = message;
    winOverlay.classList.remove('hidden');
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

myLevelsBtn.addEventListener('click', () => {
    if (!authManager.isSignedIn()) {
        authPopup.classList.remove('hidden');
    } else {
        loadUserLevels();
        showScreen(myLevelsModule);
    }
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

myLevelsBtn.addEventListener('click', () => {
    if (!authManager.isSignedIn()) {
        authPopup.classList.remove('hidden');
    } else {
        loadUserLevels();
        showScreen(myLevelsModule);
    }
});

closeLevelsBtn.addEventListener('click', () => {
    showScreen(menuScreen);
});

addLevelBtn.addEventListener('click', () => {
    editingLevelId = null; // Reset editing state for new level
    if (!levelEditor) {
        levelEditor = new LevelEditor(levelEditorCanvas);
    } else {
        levelEditor.clear();
    }
    showScreen(levelEditorScreen);
});

cancelEditorBtn.addEventListener('click', () => {
    showScreen(myLevelsModule);
});

submitLevelBtn.addEventListener('click', async () => {
    if (!authManager.isSignedIn()) {
        alert('You must be signed in to save levels');
        return;
    }
    
    const levelData = levelEditor.getLevelData();
    
    // If editing an existing level, update it without asking for name
    if (editingLevelId) {
        await updateLevel(editingLevelId, levelData);
        editingLevelId = null;
    } else {
        // New level - ask for name
        const levelName = prompt('Enter a name for your level:');
        if (!levelName || levelName.trim() === '') {
            return;
        }
        await saveLevel(levelName.trim(), levelData);
    }
    
    showScreen(myLevelsModule);
    loadUserLevels();
});

signInBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!email || !password) {
        authError.textContent = 'Please enter email and password';
        return;
    }
    
    try {
        await authManager.signIn(email, password);
        authPopup.classList.add('hidden');
        authEmail.value = '';
        authPassword.value = '';
        authError.textContent = '';
        await loadUserLevels();
        showScreen(myLevelsModule);
    } catch (error) {
        authError.textContent = error.message || 'Sign in failed';
    }
});

signUpBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!email || !password) {
        authError.textContent = 'Please enter email and password';
        return;
    }
    
    if (password.length < 6) {
        authError.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    try {
        await authManager.signUp(email, password);
        authPopup.classList.add('hidden');
        authEmail.value = '';
        authPassword.value = '';
        authError.textContent = '';
        await loadUserLevels();
        showScreen(myLevelsModule);
    } catch (error) {
        authError.textContent = error.message || 'Sign up failed';
    }
});

cancelAuthBtn.addEventListener('click', () => {
    authPopup.classList.add('hidden');
    authEmail.value = '';
    authPassword.value = '';
    authError.textContent = '';
});

function resetToMenu() {
    showScreen(menuScreen);
    if (game) {
        game.stop();
        game.reset();
    }
    opponentPlayerId = null;
    roomCodeInput.value = '';
    joinError.textContent = '';
    waitingText.textContent = 'Waiting for Player B...';
    countdownOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    clearMatchTimer();
    setScores([]);
    lastHeadBounceBoostTime.clear();
    networkManager.connect();
}

// Firebase level management functions
async function saveLevel(name, blocks) {
    if (!authManager.isSignedIn()) return;
    
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = window.firebaseDb;
    
    try {
        await addDoc(collection(db, 'levels'), {
            userId: authManager.getUserId(),
            name: name,
            blocks: blocks,
            createdAt: new Date()
        });
    } catch (error) {
        console.error('Error saving level:', error);
        alert('Failed to save level');
    }
}

async function updateLevel(levelId, blocks) {
    if (!authManager.isSignedIn()) return;
    
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = window.firebaseDb;
    
    try {
        await updateDoc(doc(db, 'levels', levelId), {
            blocks: blocks,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error updating level:', error);
        alert('Failed to update level');
    }
}

async function loadUserLevels() {
    if (!authManager.isSignedIn()) {
        levelsList.innerHTML = '<p class="no-levels-text">You currently have no levels</p>';
        return;
    }
    
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = window.firebaseDb;
    
    try {
        const q = query(collection(db, 'levels'), where('userId', '==', authManager.getUserId()));
        const querySnapshot = await getDocs(q);
        
        userLevels = [];
        querySnapshot.forEach((doc) => {
            userLevels.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderLevelsList();
    } catch (error) {
        console.error('Error loading levels:', error);
        levelsList.innerHTML = '<p class="no-levels-text">Error loading levels</p>';
    }
}

function renderLevelsList() {
    if (userLevels.length === 0) {
        levelsList.innerHTML = '<p class="no-levels-text">You currently have no levels</p>';
        return;
    }
    
    levelsList.innerHTML = userLevels.map(level => `
        <div class="level-item">
            <div class="level-item-name">${level.name}</div>
            <div class="level-item-actions">
                <button class="btn btn-small btn-secondary edit-level-btn" data-level-id="${level.id}">Edit</button>
                <button class="btn btn-small btn-primary play-level-btn" data-level-id="${level.id}">Play</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.edit-level-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const levelId = e.target.dataset.levelId;
            const level = userLevels.find(l => l.id === levelId);
            if (level) {
                editingLevelId = levelId; // Track that we're editing
                if (!levelEditor) {
                    levelEditor = new LevelEditor(levelEditorCanvas);
                }
                levelEditor.loadLevelData(level.blocks);
                showScreen(levelEditorScreen);
            }
        });
    });
    
    document.querySelectorAll('.play-level-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const levelId = e.target.dataset.levelId;
            const level = userLevels.find(l => l.id === levelId);
            if (level) {
                // Create room with custom level
                networkManager.createRoomWithLevel(level);
                // Show room creation screen
                showScreen(createRoomScreen);
                waitingText.textContent = 'Waiting for Player B...';
            }
        });
    });
}

// Override auth manager callbacks
authManager.onSignedIn = () => {
    loadUserLevels();
};

authManager.onSignedOut = () => {
    userLevels = [];
    levelsList.innerHTML = '<p class="no-levels-text">You currently have no levels</p>';
};
