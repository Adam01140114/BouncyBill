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
const settingsBtn = document.getElementById('settingsBtn');
const settingsModule = document.getElementById('settingsModule');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const playerSizeInput = document.getElementById('playerSize');
const baseOscillationSpeedInput = document.getElementById('baseOscillationSpeed');
const activeOscillationSpeedInput = document.getElementById('activeOscillationSpeed');
const dormantOscillationSpeedInput = document.getElementById('dormantOscillationSpeed');
const dormantMinAngleInput = document.getElementById('dormantMinAngle');
const dormantMaxAngleInput = document.getElementById('dormantMaxAngle');
const activeMinAngleInput = document.getElementById('activeMinAngle');
const activeMaxAngleInput = document.getElementById('activeMaxAngle');
const miniBoostStrengthInput = document.getElementById('miniBoostStrength');
const minBouncePowerInput = document.getElementById('minBouncePower');
const maxBouncePowerInput = document.getElementById('maxBouncePower');
const playerSizeValue = document.getElementById('playerSizeValue');
const baseOscillationSpeedValue = document.getElementById('baseOscillationSpeedValue');
const activeOscillationSpeedValue = document.getElementById('activeOscillationSpeedValue');
const dormantOscillationSpeedValue = document.getElementById('dormantOscillationSpeedValue');
const activeFinalSpeed = document.getElementById('activeFinalSpeed');
const dormantFinalSpeed = document.getElementById('dormantFinalSpeed');
const miniBoostStrengthValue = document.getElementById('miniBoostStrengthValue');
const minBouncePowerValue = document.getElementById('minBouncePowerValue');
const maxBouncePowerValue = document.getElementById('maxBouncePowerValue');
const settingsMessage = document.getElementById('settingsMessage');

// Function to update final speed displays
function updateFinalSpeeds() {
    const baseSpeed = parseFloat(baseOscillationSpeedInput.value) || 0.036;
    const activeMultiplier = parseFloat(activeOscillationSpeedInput.value) || 1.1;
    const dormantMultiplier = parseFloat(dormantOscillationSpeedInput.value) || 1.1;
    activeFinalSpeed.textContent = (baseSpeed * activeMultiplier).toFixed(5);
    dormantFinalSpeed.textContent = (baseSpeed * dormantMultiplier).toFixed(5);
}

// Update slider value displays in real-time
playerSizeInput.addEventListener('input', (e) => {
    playerSizeValue.textContent = parseFloat(e.target.value).toFixed(1);
});

baseOscillationSpeedInput.addEventListener('input', (e) => {
    baseOscillationSpeedValue.textContent = parseFloat(e.target.value).toFixed(3);
    updateFinalSpeeds();
});

activeOscillationSpeedInput.addEventListener('input', (e) => {
    activeOscillationSpeedValue.textContent = parseFloat(e.target.value).toFixed(2);
    updateFinalSpeeds();
});

dormantOscillationSpeedInput.addEventListener('input', (e) => {
    dormantOscillationSpeedValue.textContent = parseFloat(e.target.value).toFixed(2);
    updateFinalSpeeds();
});

miniBoostStrengthInput.addEventListener('input', (e) => {
    miniBoostStrengthValue.textContent = parseFloat(e.target.value).toFixed(2);
});

minBouncePowerInput.addEventListener('input', (e) => {
    minBouncePowerValue.textContent = parseFloat(e.target.value).toFixed(2);
});

maxBouncePowerInput.addEventListener('input', (e) => {
    maxBouncePowerValue.textContent = parseFloat(e.target.value).toFixed(2);
});

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
        // Load and apply user settings
        loadUserSettings().then(() => {
            const playerSize = parseFloat(playerSizeInput.value) || 1.2;
            const baseSpeed = parseFloat(baseOscillationSpeedInput.value) || 0.036;
            const activeSpeed = parseFloat(activeOscillationSpeedInput.value) || 1.1;
            const dormantSpeed = parseFloat(dormantOscillationSpeedInput.value) || 1.1;
            const dormantMinAngle = parseFloat(dormantMinAngleInput.value) || 50;
            const dormantMaxAngle = parseFloat(dormantMaxAngleInput.value) || 130;
            const activeMinAngle = parseFloat(activeMinAngleInput.value) || 30;
            const activeMaxAngle = parseFloat(activeMaxAngleInput.value) || 150;
            const miniBoost = parseFloat(miniBoostStrengthInput.value) || 10.21;
            const minBounce = parseFloat(minBouncePowerInput.value) || 6.0;
            const maxBounce = parseFloat(maxBouncePowerInput.value) || 11.25;
            game.updatePlayerSize(playerSize);
            game.updateOscillationSpeeds(baseSpeed, activeSpeed, dormantSpeed);
            game.updateOscillationRanges(dormantMinAngle, dormantMaxAngle, activeMinAngle, activeMaxAngle);
            game.updateBoostSettings(miniBoost, minBounce, maxBounce);
        });
        game.start();
    } else {
        game.reset();
        // Reload settings when game resets
        loadUserSettings().then(() => {
            const playerSize = parseFloat(playerSizeInput.value) || 1.2;
            const baseSpeed = parseFloat(baseOscillationSpeedInput.value) || 0.036;
            const activeSpeed = parseFloat(activeOscillationSpeedInput.value) || 1.1;
            const dormantSpeed = parseFloat(dormantOscillationSpeedInput.value) || 1.1;
            const dormantMinAngle = parseFloat(dormantMinAngleInput.value) || 50;
            const dormantMaxAngle = parseFloat(dormantMaxAngleInput.value) || 130;
            const activeMinAngle = parseFloat(activeMinAngleInput.value) || 30;
            const activeMaxAngle = parseFloat(activeMaxAngleInput.value) || 150;
            const miniBoost = parseFloat(miniBoostStrengthInput.value) || 10.21;
            const minBounce = parseFloat(minBouncePowerInput.value) || 6.0;
            const maxBounce = parseFloat(maxBouncePowerInput.value) || 11.25;
            game.updatePlayerSize(playerSize);
            game.updateOscillationSpeeds(baseSpeed, activeSpeed, dormantSpeed);
            game.updateOscillationRanges(dormantMinAngle, dormantMaxAngle, activeMinAngle, activeMaxAngle);
            game.updateBoostSettings(miniBoost, minBounce, maxBounce);
        });
    }

    // Set custom level if present
    if (data.customLevel) {

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

    // Add double-click listener to skip countdown (only add once)
    if (!countdownOverlay.hasAttribute('data-dblclick-listener')) {
        countdownOverlay.setAttribute('data-dblclick-listener', 'true');
        countdownOverlay.addEventListener('dblclick', () => {
            networkManager.skipCountdown();
        });
    }

    // Store match duration to start timer when countdown ends
    if (data.matchDuration) {
        pendingTimerDuration = data.matchDuration;
    }
});

networkManager.on('countdown', (data) => {
    if (data.countdown > 0) {
        countdownText.textContent = data.countdown;
    } else {
        // Countdown reached 0 (Bounce screen) - skip it entirely and start game immediately
        countdownOverlay.classList.add('hidden');
        if (game) {
            game.gameStarted = true;
        }
        // Start timer when game actually starts
        if (pendingTimerDuration) {
            startMatchTimer(pendingTimerDuration);
            pendingTimerDuration = null;
        } else if (data.matchDuration) {
            // Fallback: use matchDuration from countdown event if pendingTimerDuration wasn't set
            startMatchTimer(data.matchDuration);
        }
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

    if (!game) {

        return;
    }

    // Apply mini boost to the attacker (with cooldown to prevent multiple boosts)
    const now = Date.now();
    const lastBoostTime = lastHeadBounceBoostTime.get(data.attackerId) || 0;
    const timeSinceLastBoost = now - lastBoostTime;

    if (timeSinceLastBoost >= 670) {
        // Only apply boost if cooldown has passed
        lastHeadBounceBoostTime.set(data.attackerId, now);

        game.applyHeadBounceBoost(data.attackerId);
    } else {

    }

    // Freeze arrow oscillation for the player who GOT bounced on (target)
    // Their arrow will stop oscillating for 1 second
    game.freezeArrowFor(data.targetId, 1000);

    if (game.localPlayerId === data.attackerId) {
        const timeSinceLastAlert = now - lastHeadBounceAlertTime;

        if (timeSinceLastAlert < 670) {

            return;
        }
        lastHeadBounceAlertTime = now;

        alert('You bounced on their head!');
    } else {

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

// Settings button event listeners
settingsBtn.addEventListener('click', async () => {
    if (!authManager.isSignedIn()) {
        authPopup.classList.remove('hidden');
    } else {
        await loadUserSettings();
        showScreen(settingsModule);
    }
});

closeSettingsBtn.addEventListener('click', () => {
    showScreen(menuScreen);
});

saveSettingsBtn.addEventListener('click', async () => {
    await saveUserSettings();
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

        levelsList.innerHTML = '<p class="no-levels-text">Error loading levels</p>';
    }
}

// Firebase settings management functions
async function saveUserSettings() {
    if (!authManager.isSignedIn()) {
        settingsMessage.textContent = 'You must be signed in to save settings';
        settingsMessage.style.color = 'red';
        return;
    }

    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = window.firebaseDb;

    try {
        // Parse all values and ensure they're valid numbers
        const playerSize = parseFloat(playerSizeInput.value);
        const baseSpeed = parseFloat(baseOscillationSpeedInput.value);
        const activeSpeed = parseFloat(activeOscillationSpeedInput.value);
        const dormantSpeed = parseFloat(dormantOscillationSpeedInput.value);
        const dormantMinAngle = parseFloat(dormantMinAngleInput.value);
        const dormantMaxAngle = parseFloat(dormantMaxAngleInput.value);
        const activeMinAngle = parseFloat(activeMinAngleInput.value);
        const activeMaxAngle = parseFloat(activeMaxAngleInput.value);
        const miniBoost = parseFloat(miniBoostStrengthInput.value);
        const minBounce = parseFloat(minBouncePowerInput.value);
        const maxBounce = parseFloat(maxBouncePowerInput.value);

        // Validate all inputs are numbers first
        if (isNaN(playerSize) || isNaN(baseSpeed) || isNaN(activeSpeed) || isNaN(dormantSpeed) ||
            isNaN(dormantMinAngle) || isNaN(dormantMaxAngle) || isNaN(activeMinAngle) || isNaN(activeMaxAngle) ||
            isNaN(miniBoost) || isNaN(minBounce) || isNaN(maxBounce)) {
            settingsMessage.textContent = 'All settings must be valid numbers';
            settingsMessage.style.color = 'red';
            console.error('Validation failed - NaN values detected:', {
                playerSize, baseSpeed, activeSpeed, dormantSpeed,
                dormantMinAngle, dormantMaxAngle, activeMinAngle, activeMaxAngle,
                miniBoost, minBounce, maxBounce
            });
            return;
        }

        // Validate inputs
        if (playerSize < 0.5 || playerSize > 7.0) {
            settingsMessage.textContent = 'Player size must be between 0.5 and 7.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (baseSpeed < 0.01 || baseSpeed > 0.1) {
            settingsMessage.textContent = 'Base oscillation speed must be between 0.01 and 0.1';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(activeSpeed) || activeSpeed < 0.1 || activeSpeed > 3.0) {
            settingsMessage.textContent = 'Active oscillation speed must be between 0.1 and 3.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(dormantSpeed) || dormantSpeed < 0.1 || dormantSpeed > 3.0) {
            settingsMessage.textContent = 'Dormant oscillation speed must be between 0.1 and 3.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(dormantMinAngle) || dormantMinAngle < 0 || dormantMinAngle > 180) {
            settingsMessage.textContent = 'Dormant min angle must be between 0 and 180 degrees';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(dormantMaxAngle) || dormantMaxAngle < 0 || dormantMaxAngle > 180) {
            settingsMessage.textContent = 'Dormant max angle must be between 0 and 180 degrees';
            settingsMessage.style.color = 'red';
            return;
        }

        if (dormantMinAngle >= dormantMaxAngle) {
            settingsMessage.textContent = 'Dormant min angle must be less than max angle';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(activeMinAngle) || activeMinAngle < 0 || activeMinAngle > 180) {
            settingsMessage.textContent = 'Active min angle must be between 0 and 180 degrees';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(activeMaxAngle) || activeMaxAngle < 0 || activeMaxAngle > 180) {
            settingsMessage.textContent = 'Active max angle must be between 0 and 180 degrees';
            settingsMessage.style.color = 'red';
            return;
        }

        if (activeMinAngle >= activeMaxAngle) {
            settingsMessage.textContent = 'Active min angle must be less than max angle';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(miniBoost) || miniBoost < 5.0 || miniBoost > 20.0) {
            settingsMessage.textContent = 'Mini boost strength must be between 5.0 and 20.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(minBounce) || minBounce < 1.0 || minBounce > 15.0) {
            settingsMessage.textContent = 'Minimum bounce power must be between 1.0 and 15.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (isNaN(maxBounce) || maxBounce < 5.0 || maxBounce > 25.0) {
            settingsMessage.textContent = 'Maximum bounce power must be between 5.0 and 25.0';
            settingsMessage.style.color = 'red';
            return;
        }

        if (minBounce >= maxBounce) {
            settingsMessage.textContent = 'Minimum bounce power must be less than maximum bounce power';
            settingsMessage.style.color = 'red';
            return;
        }

        const userId = authManager.getUserId();
        const settingsRef = doc(db, 'userSettings', userId);

        // Ensure all values are numbers (not NaN) before saving
        const settingsData = {
            playerSize: Number(playerSize),
            baseOscillationSpeed: Number(baseSpeed),
            activeOscillationSpeed: Number(activeSpeed),
            dormantOscillationSpeed: Number(dormantSpeed),
            dormantMinAngle: Number(dormantMinAngle),
            dormantMaxAngle: Number(dormantMaxAngle),
            activeMinAngle: Number(activeMinAngle),
            activeMaxAngle: Number(activeMaxAngle),
            miniBoostStrength: Number(miniBoost),
            minBouncePower: Number(minBounce),
            maxBouncePower: Number(maxBounce),
            updatedAt: new Date()
        };

        // Double-check no NaN values
        for (const [key, value] of Object.entries(settingsData)) {
            if (key !== 'updatedAt' && (isNaN(value) || !isFinite(value))) {
                settingsMessage.textContent = `Invalid value for ${key}: ${value}`;
                settingsMessage.style.color = 'red';
                console.error(`Invalid setting value: ${key} = ${value}`);
                return;
            }
        }

        // Log settings data before saving for debugging
        console.log('Saving settings to Firebase:', settingsData);

        try {
            await setDoc(settingsRef, settingsData, { merge: true });
        } catch (firebaseError) {
            console.error('Firebase error details:', firebaseError);
            console.error('Settings data that failed:', settingsData);
            settingsMessage.textContent = `Error saving settings: ${firebaseError.message}`;
            settingsMessage.style.color = 'red';
            return;
        }

        settingsMessage.textContent = 'Settings saved successfully!';
        settingsMessage.style.color = 'white';

        // Update game if it's running
        if (game) {
            game.updatePlayerSize(playerSize);
            game.updateOscillationSpeeds(baseSpeed, activeSpeed, dormantSpeed);
            game.updateOscillationRanges(dormantMinAngle, dormantMaxAngle, activeMinAngle, activeMaxAngle);
            game.updateBoostSettings(miniBoost, minBounce, maxBounce);
        }

        // Close settings modal after showing success message (1 second delay)
        setTimeout(() => {
            settingsMessage.textContent = '';
            showScreen(menuScreen);
        }, 1000);
    } catch (error) {
        console.error('Error saving settings:', error);
        settingsMessage.textContent = 'Failed to save settings';
        settingsMessage.style.color = 'red';
    }
}

async function loadUserSettings() {
    // Default values
    const defaults = {
        playerSize: '1.2',
        baseOscillationSpeed: '0.036',
        activeOscillationSpeed: '1.1',
        dormantOscillationSpeed: '1.1',
        dormantMinAngle: '50',
        dormantMaxAngle: '130',
        activeMinAngle: '30',
        activeMaxAngle: '150',
        miniBoostStrength: '10.21',
        minBouncePower: '6.0',
        maxBouncePower: '11.25'
    };

    if (!authManager.isSignedIn()) {
        // Reset to defaults if not signed in
        playerSizeInput.value = defaults.playerSize;
        baseOscillationSpeedInput.value = defaults.baseOscillationSpeed;
        activeOscillationSpeedInput.value = defaults.activeOscillationSpeed;
        dormantOscillationSpeedInput.value = defaults.dormantOscillationSpeed;
        dormantMinAngleInput.value = defaults.dormantMinAngle;
        dormantMaxAngleInput.value = defaults.dormantMaxAngle;
        activeMinAngleInput.value = defaults.activeMinAngle;
        activeMaxAngleInput.value = defaults.activeMaxAngle;
        miniBoostStrengthInput.value = defaults.miniBoostStrength;
        minBouncePowerInput.value = defaults.minBouncePower;
        maxBouncePowerInput.value = defaults.maxBouncePower;
        // Update display values
        playerSizeValue.textContent = defaults.playerSize;
        baseOscillationSpeedValue.textContent = defaults.baseOscillationSpeed;
        activeOscillationSpeedValue.textContent = defaults.activeOscillationSpeed;
        dormantOscillationSpeedValue.textContent = defaults.dormantOscillationSpeed;
        miniBoostStrengthValue.textContent = defaults.miniBoostStrength;
        minBouncePowerValue.textContent = defaults.minBouncePower;
        maxBouncePowerValue.textContent = defaults.maxBouncePower;
        updateFinalSpeeds();
        return;
    }

    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const db = window.firebaseDb;

    try {
        const userId = authManager.getUserId();
        const settingsRef = doc(db, 'userSettings', userId);
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            playerSizeInput.value = settings.playerSize || defaults.playerSize;
            baseOscillationSpeedInput.value = settings.baseOscillationSpeed || defaults.baseOscillationSpeed;
            activeOscillationSpeedInput.value = settings.activeOscillationSpeed || defaults.activeOscillationSpeed;
            dormantOscillationSpeedInput.value = settings.dormantOscillationSpeed || defaults.dormantOscillationSpeed;
            dormantMinAngleInput.value = settings.dormantMinAngle || defaults.dormantMinAngle;
            dormantMaxAngleInput.value = settings.dormantMaxAngle || defaults.dormantMaxAngle;
            activeMinAngleInput.value = settings.activeMinAngle || defaults.activeMinAngle;
            activeMaxAngleInput.value = settings.activeMaxAngle || defaults.activeMaxAngle;
            miniBoostStrengthInput.value = settings.miniBoostStrength || defaults.miniBoostStrength;
            minBouncePowerInput.value = settings.minBouncePower || defaults.minBouncePower;
            maxBouncePowerInput.value = settings.maxBouncePower || defaults.maxBouncePower;
        } else {
            // Use defaults if no settings exist
            playerSizeInput.value = defaults.playerSize;
            baseOscillationSpeedInput.value = defaults.baseOscillationSpeed;
            activeOscillationSpeedInput.value = defaults.activeOscillationSpeed;
            dormantOscillationSpeedInput.value = defaults.dormantOscillationSpeed;
            dormantMinAngleInput.value = defaults.dormantMinAngle;
            dormantMaxAngleInput.value = defaults.dormantMaxAngle;
            activeMinAngleInput.value = defaults.activeMinAngle;
            activeMaxAngleInput.value = defaults.activeMaxAngle;
            miniBoostStrengthInput.value = defaults.miniBoostStrength;
            minBouncePowerInput.value = defaults.minBouncePower;
            maxBouncePowerInput.value = defaults.maxBouncePower;
        }
        
        // Update display values
        playerSizeValue.textContent = parseFloat(playerSizeInput.value).toFixed(1);
        baseOscillationSpeedValue.textContent = parseFloat(baseOscillationSpeedInput.value).toFixed(3);
        activeOscillationSpeedValue.textContent = parseFloat(activeOscillationSpeedInput.value).toFixed(2);
        dormantOscillationSpeedValue.textContent = parseFloat(dormantOscillationSpeedInput.value).toFixed(2);
        miniBoostStrengthValue.textContent = parseFloat(miniBoostStrengthInput.value).toFixed(2);
        minBouncePowerValue.textContent = parseFloat(minBouncePowerInput.value).toFixed(2);
        maxBouncePowerValue.textContent = parseFloat(maxBouncePowerInput.value).toFixed(2);
        updateFinalSpeeds();
    } catch (error) {
        console.error('Error loading settings:', error);
        // Use defaults on error
        playerSizeInput.value = defaults.playerSize;
        baseOscillationSpeedInput.value = defaults.baseOscillationSpeed;
        activeOscillationSpeedInput.value = defaults.activeOscillationSpeed;
        dormantOscillationSpeedInput.value = defaults.dormantOscillationSpeed;
        dormantMinAngleInput.value = defaults.dormantMinAngle;
        dormantMaxAngleInput.value = defaults.dormantMaxAngle;
        activeMinAngleInput.value = defaults.activeMinAngle;
        activeMaxAngleInput.value = defaults.activeMaxAngle;
        miniBoostStrengthInput.value = defaults.miniBoostStrength;
        minBouncePowerInput.value = defaults.minBouncePower;
        maxBouncePowerInput.value = defaults.maxBouncePower;
        // Update display values
        playerSizeValue.textContent = defaults.playerSize;
        baseOscillationSpeedValue.textContent = defaults.baseOscillationSpeed;
        activeOscillationSpeedValue.textContent = defaults.activeOscillationSpeed;
        dormantOscillationSpeedValue.textContent = defaults.dormantOscillationSpeed;
        miniBoostStrengthValue.textContent = defaults.miniBoostStrength;
        minBouncePowerValue.textContent = defaults.minBouncePower;
        maxBouncePowerValue.textContent = defaults.maxBouncePower;
        updateFinalSpeeds();
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
authManager.onSignedIn = async () => {
    await loadUserSettings();
    // Apply settings to game if it exists
    if (game) {
        const playerSize = parseFloat(playerSizeInput.value) || 1.2;
        const baseSpeed = parseFloat(baseOscillationSpeedInput.value) || 0.036;
        const activeSpeed = parseFloat(activeOscillationSpeedInput.value) || 1.1;
        const dormantSpeed = parseFloat(dormantOscillationSpeedInput.value) || 1.1;
        const dormantMinAngle = parseFloat(dormantMinAngleInput.value) || 50;
        const dormantMaxAngle = parseFloat(dormantMaxAngleInput.value) || 130;
        const activeMinAngle = parseFloat(activeMinAngleInput.value) || 30;
        const activeMaxAngle = parseFloat(activeMaxAngleInput.value) || 150;
        const miniBoost = parseFloat(miniBoostStrengthInput.value) || 10.21;
        const minBounce = parseFloat(minBouncePowerInput.value) || 6.0;
        const maxBounce = parseFloat(maxBouncePowerInput.value) || 11.25;
        game.updatePlayerSize(playerSize);
        game.updateOscillationSpeeds(baseSpeed, activeSpeed, dormantSpeed);
        game.updateOscillationRanges(dormantMinAngle, dormantMaxAngle, activeMinAngle, activeMaxAngle);
        game.updateBoostSettings(miniBoost, minBounce, maxBounce);
    }
    loadUserLevels();
};

authManager.onSignedOut = () => {
    userLevels = [];
    levelsList.innerHTML = '<p class="no-levels-text">You currently have no levels</p>';
};
