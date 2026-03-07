const cells = document.querySelectorAll('.cell');
const boardEl = document.getElementById('board');
const winLine = document.getElementById('win-line');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const undoBtn = document.getElementById('undo');
const resetScoresBtn = document.getElementById('reset-scores');
const modeBtn = document.getElementById('mode');
const scoreLabelX = document.getElementById('score-label-x');
const scoreLabelO = document.getElementById('score-label-o');
const scoreCardX = document.querySelector('.score-item.score-x');
const scoreCardO = document.querySelector('.score-item.score-o');

let currentPlayer = 'X';
let gameActive = true;
let aiMode = false;
let board = ['', '', '', '', '', '', '', '', ''];
let moveHistory = [];
let aiTimeoutId = null;
let autoAdvanceIntervalId = null;
let autoAdvanceTimeoutId = null;
let aiDifficulty = localStorage.getItem('aiDifficulty') || 'hard';

// Multiplayer state
let multiplayerMode = false;
let peer = null;
let conn = null;
let myRole = null; // 'X' (host) or 'O' (joiner)

function loadPlayerNames() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem('playerNames') || 'null');
    } catch {
        saved = null;
    }
    return {
        X: sanitizePlayerName(saved?.X, 'X'),
        O: sanitizePlayerName(saved?.O, 'O')
    };
}

let playerNames = loadPlayerNames();

let savedScores = null;
try {
    savedScores = JSON.parse(localStorage.getItem('scores') || 'null');
} catch {
    savedScores = null;
}
const scores = {
    X: Number.isInteger(savedScores?.X) ? savedScores.X : 0,
    O: Number.isInteger(savedScores?.O) ? savedScores.O : 0,
    draw: Number.isInteger(savedScores?.draw) ? savedScores.draw : 0
};

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function sanitizePlayerName(raw, player) {
    const trimmed = String(raw || '').trim().slice(0, 16);
    return trimmed || `Player ${player}`;
}

function getPlayerName(player) {
    if (multiplayerMode) return player === myRole ? 'You' : 'Opponent';
    if (aiMode && player === 'O') return 'AI';
    return playerNames[player];
}

function persistPlayerNames() {
    localStorage.setItem('playerNames', JSON.stringify(playerNames));
}

function updateNameDisplay() {
    scoreLabelX.textContent = getPlayerName('X');
    scoreLabelO.textContent = getPlayerName('O');
}

function updateStatus(text, type) {
    statusDisplay.textContent = text;
    statusDisplay.className = type ? `status-${type.toLowerCase()}` : '';
}

function clearAutoAdvance() {
    if (autoAdvanceIntervalId !== null) {
        clearInterval(autoAdvanceIntervalId);
        autoAdvanceIntervalId = null;
    }
    if (autoAdvanceTimeoutId !== null) {
        clearTimeout(autoAdvanceTimeoutId);
        autoAdvanceTimeoutId = null;
    }
}

function setActivePlayerHighlight() {
    scoreCardX.classList.remove('active-turn');
    scoreCardO.classList.remove('active-turn');

    if (!gameActive) return;

    if (currentPlayer === 'X') scoreCardX.classList.add('active-turn');
    if (currentPlayer === 'O') scoreCardO.classList.add('active-turn');
}

function updateUndoButtonState() {
    undoBtn.disabled = aiMode || multiplayerMode || !gameActive || moveHistory.length === 0;
}

function setAiThinking(isThinking) {
    boardEl.classList.toggle('ai-thinking', isThinking);
}

function triggerConfettiBurst(player) {
    const burst = document.createElement('div');
    burst.className = `confetti-burst ${player.toLowerCase()}`;

    for (let i = 0; i < 28; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 120;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        piece.style.setProperty('--dx', `${dx}px`);
        piece.style.setProperty('--dy', `${dy}px`);
        piece.style.setProperty('--rot', `${Math.floor(Math.random() * 720 - 360)}deg`);
        piece.style.setProperty('--delay', `${Math.floor(Math.random() * 80)}ms`);
        piece.style.setProperty('--duration', `${620 + Math.floor(Math.random() * 320)}ms`);
        burst.appendChild(piece);
    }

    boardEl.appendChild(burst);
    setTimeout(() => burst.remove(), 1100);
}

function startAutoAdvance(message, type) {
    if (multiplayerMode) return; // in multiplayer, wait for manual New Game
    clearAutoAdvance();
    let remaining = 3;
    updateStatus(`${message} Next round in ${remaining}...`, type);

    autoAdvanceIntervalId = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
            updateStatus(`${message} Next round in ${remaining}...`, type);
        }
    }, 1000);

    autoAdvanceTimeoutId = setTimeout(() => {
        clearAutoAdvance();
        resetGame({ preserveCountdown: false });
    }, 3000);
}

function getTurnMessage() {
    if (multiplayerMode) {
        if (currentPlayer === myRole) return `Your turn (${currentPlayer})`;
        return `Opponent's turn (${currentPlayer})`;
    }
    if (aiMode && currentPlayer === 'O') return "AI's turn";
    return `${getPlayerName(currentPlayer)}'s turn`;
}

function handleCellClick(e) {
    const index = parseInt(e.currentTarget.getAttribute('data-cell-index'), 10);
    attemptMove(index);
}

function handleCellKeydown(e) {
    const index = parseInt(e.currentTarget.getAttribute('data-cell-index'), 10);
    let nextIndex = null;

    if (e.key === 'ArrowLeft' && index % 3 !== 0) nextIndex = index - 1;
    if (e.key === 'ArrowRight' && index % 3 !== 2) nextIndex = index + 1;
    if (e.key === 'ArrowUp' && index >= 3) nextIndex = index - 3;
    if (e.key === 'ArrowDown' && index <= 5) nextIndex = index + 3;

    if (nextIndex !== null) {
        e.preventDefault();
        cells[nextIndex].focus();
        return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        attemptMove(index);
    }
}

function attemptMove(index) {
    if (board[index] !== '' || !gameActive) return;
    if (aiMode && currentPlayer === 'O') return;
    if (multiplayerMode && currentPlayer !== myRole) return;

    const player = aiMode ? 'X' : currentPlayer;
    makeMove(index, player);

    if (multiplayerMode && conn) {
        conn.send({ type: 'move', index });
    }

    if (aiMode && gameActive) {
        setAiThinking(true);
        aiTimeoutId = setTimeout(aiMove, 400);
    }
}

function makeMove(index, player) {
    board[index] = player;
    moveHistory.push({ index, player });

    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase(), 'taken', 'pop');
    cell.addEventListener('animationend', () => cell.classList.remove('pop'), { once: true });

    const result = checkResult();
    if (result === 'win') {
        const winnerName = getPlayerName(player);
        const message = `${winnerName} wins!`;
        updateStatus(message, player);
        triggerConfettiBurst(player);
        scores[player] += 1;
        updateScoreDisplay();
        gameActive = false;
        setActivePlayerHighlight();
        updateUndoButtonState();
        startAutoAdvance(message, player);
        return;
    }

    if (result === 'draw') {
        const message = "It's a draw!";
        updateStatus(message, 'draw');
        scores.draw += 1;
        updateScoreDisplay();
        gameActive = false;
        setActivePlayerHighlight();
        updateUndoButtonState();
        startAutoAdvance(message, 'draw');
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();
}

// Pure board evaluator — no DOM side effects, safe to call from minimax
function evaluateBoard(b) {
    for (const [a, bi, c] of winningConditions) {
        if (b[a] && b[a] === b[bi] && b[a] === b[c]) {
            return b[a] === 'O' ? 1 : -1;
        }
    }
    return 0;
}

function minimax(b, depth, isMaximizing) {
    const score = evaluateBoard(b);
    if (score !== 0) return score * (10 - depth);
    if (!b.includes('')) return 0;

    const empty = b.map((v, i) => (v === '' ? i : null)).filter(v => v !== null);
    if (isMaximizing) {
        let best = -Infinity;
        for (const i of empty) {
            b[i] = 'O';
            best = Math.max(best, minimax(b, depth + 1, false));
            b[i] = '';
        }
        return best;
    }

    let best = Infinity;
    for (const i of empty) {
        b[i] = 'X';
        best = Math.min(best, minimax(b, depth + 1, true));
        b[i] = '';
    }
    return best;
}

function aiMove() {
    setAiThinking(false);
    aiTimeoutId = null;
    if (!gameActive) return;

    const empty = board.map((v, i) => (v === '' ? i : null)).filter(v => v !== null);
    if (empty.length === 0) return;

    let idx;
    if (aiDifficulty === 'easy' || (aiDifficulty === 'medium' && Math.random() < 0.5)) {
        idx = empty[Math.floor(Math.random() * empty.length)];
    } else {
        let bestScore = -Infinity;
        let bestIdx = empty[0];
        for (const i of empty) {
            const b = [...board];
            b[i] = 'O';
            const score = minimax(b, 0, false);
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        idx = bestIdx;
    }

    makeMove(idx, 'O');
}

function checkResult() {
    for (const [a, b, c] of winningConditions) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            cells[a].classList.add('winner');
            cells[b].classList.add('winner');
            cells[c].classList.add('winner');
            drawWinLine(a, b, c);
            return 'win';
        }
    }

    if (!board.includes('')) return 'draw';
    return null;
}

function drawWinLine(a, b, c) {
    winLine.className = 'win-line';
    if (a === 0 && b === 1 && c === 2) winLine.classList.add('row-0');
    else if (a === 3 && b === 4 && c === 5) winLine.classList.add('row-1');
    else if (a === 6 && b === 7 && c === 8) winLine.classList.add('row-2');
    else if (a === 0 && b === 3 && c === 6) winLine.classList.add('col-0');
    else if (a === 1 && b === 4 && c === 7) winLine.classList.add('col-1');
    else if (a === 2 && b === 5 && c === 8) winLine.classList.add('col-2');
    else if (a === 0 && b === 4 && c === 8) winLine.classList.add('diag-main');
    else if (a === 2 && b === 4 && c === 6) winLine.classList.add('diag-anti');
}

function updateScoreDisplay() {
    document.getElementById('score-x').textContent = scores.X;
    document.getElementById('score-o').textContent = scores.O;
    document.getElementById('score-draw').textContent = scores.draw;
    localStorage.setItem('scores', JSON.stringify(scores));
}

function resetBoardVisuals() {
    winLine.className = 'win-line';
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
}

function resetGame(options = {}) {
    const { preserveCountdown = false } = options;

    if (aiTimeoutId !== null) {
        clearTimeout(aiTimeoutId);
        aiTimeoutId = null;
    }

    if (!preserveCountdown) {
        clearAutoAdvance();
    }

    setAiThinking(false);
    board = ['', '', '', '', '', '', '', '', ''];
    moveHistory = [];
    resetBoardVisuals();

    gameActive = true;
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();

    if (aiMode && currentPlayer === 'O') {
        setAiThinking(true);
        aiTimeoutId = setTimeout(aiMove, 400);
    }
}

function undoLastMove() {
    if (undoBtn.disabled) return;

    const lastMove = moveHistory.pop();
    if (!lastMove) return;

    board[lastMove.index] = '';
    const cell = cells[lastMove.index];
    cell.textContent = '';
    cell.className = 'cell';

    currentPlayer = lastMove.player;
    winLine.className = 'win-line';
    cells.forEach(c => c.classList.remove('winner'));

    updateStatus(getTurnMessage(), currentPlayer);
    setActivePlayerHighlight();
    updateUndoButtonState();
}

cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
    cell.addEventListener('keydown', handleCellKeydown);
});

resetBtn.addEventListener('click', () => {
    if (multiplayerMode && myRole !== 'X') {
        updateStatus('Ask the host to start a new round.', null);
        return;
    }
    resetGame();
    if (multiplayerMode && conn) {
        conn.send({ type: 'reset', starterPlayer: currentPlayer });
    }
});

undoBtn.addEventListener('click', undoLastMove);

resetScoresBtn.addEventListener('click', () => {
    if (multiplayerMode && myRole !== 'X') {
        updateStatus('Ask the host to reset scores.', null);
        return;
    }
    scores.X = 0;
    scores.O = 0;
    scores.draw = 0;
    updateScoreDisplay();
    resetGame();
    if (multiplayerMode && conn) {
        conn.send({ type: 'reset-scores' });
        conn.send({ type: 'reset', starterPlayer: currentPlayer });
    }
});

modeBtn.addEventListener('click', () => {
    if (multiplayerMode) return;
    aiMode = !aiMode;
    modeBtn.textContent = aiMode ? 'Switch to Human Mode' : 'Switch to AI Mode';
    updateNameDisplay();
    resetGame();
});

// Settings
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const settingsPanel = document.getElementById('settings-panel');
const difficultySelect = document.getElementById('difficulty-select');
const playerXNameInput = document.getElementById('player-x-name');
const playerONameInput = document.getElementById('player-o-name');

function openSettings() {
    settingsOverlay.classList.remove('hidden');
    darkModeToggle.focus();
}

function closeSettings() {
    settingsOverlay.classList.add('hidden');
    settingsBtn.focus();
}

function savePlayerName(player, rawValue) {
    playerNames[player] = sanitizePlayerName(rawValue, player);
    persistPlayerNames();
    updateNameDisplay();

    if (gameActive) {
        updateStatus(getTurnMessage(), currentPlayer);
    }
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);

settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

settingsOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettings();
        return;
    }

    if (e.key === 'Tab') {
        const focusable = settingsPanel.querySelectorAll('input, button, select, [tabindex]');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

playerXNameInput.value = playerNames.X;
playerONameInput.value = playerNames.O;

playerXNameInput.addEventListener('change', () => {
    savePlayerName('X', playerXNameInput.value);
    playerXNameInput.value = playerNames.X;
});

playerONameInput.addEventListener('change', () => {
    savePlayerName('O', playerONameInput.value);
    playerONameInput.value = playerNames.O;
});

darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode', darkModeToggle.checked);
    localStorage.setItem('darkMode', darkModeToggle.checked);
});

// Load saved preferences
if (localStorage.getItem('darkMode') === 'true') {
    darkModeToggle.checked = true;
    document.body.classList.add('dark-mode');
}

difficultySelect.value = aiDifficulty;
difficultySelect.addEventListener('change', () => {
    aiDifficulty = difficultySelect.value;
    localStorage.setItem('aiDifficulty', aiDifficulty);
});

// ---- Multiplayer (PeerJS WebRTC) ----
const mpBtn = document.getElementById('mp-btn');
const mpOverlay = document.getElementById('mp-overlay');
const mpLobby = document.getElementById('mp-lobby');
const mpWaiting = document.getElementById('mp-waiting');
const mpRoomCode = document.getElementById('mp-room-code');
const mpStatusText = document.getElementById('mp-status-text');
const mpCodeInput = document.getElementById('mp-code-input');
const mpHint = document.getElementById('mp-hint');

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function isValidPlayerSymbol(value) {
    return value === 'X' || value === 'O';
}

function openMultiplayerLobby() {
    mpOverlay.classList.remove('hidden');
    mpLobby.classList.remove('hidden');
    mpWaiting.classList.add('hidden');
    mpStatusText.textContent = '';
    mpStatusText.className = 'mp-status';
    mpCodeInput.value = '';
}

function closeMultiplayerLobby() {
    mpOverlay.classList.add('hidden');
}

function setMpStatus(text, type) {
    mpStatusText.textContent = text;
    mpStatusText.className = `mp-status${type ? ' ' + type : ''}`;
}

function destroyPeer() {
    if (conn) { try { conn.close(); } catch {} conn = null; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
}

function enterMultiplayerMode(role) {
    multiplayerMode = true;
    myRole = role;
    aiMode = false;
    modeBtn.textContent = 'Switch to AI Mode';
    modeBtn.disabled = true;
    closeMultiplayerLobby();
    mpBtn.textContent = 'Disconnect';
    updateNameDisplay();
}

function exitMultiplayerMode() {
    destroyPeer();
    multiplayerMode = false;
    myRole = null;
    mpBtn.textContent = 'Multiplayer';
    modeBtn.disabled = false;
    updateNameDisplay();
    resetGame();
}

function setupConnHandlers(connection) {
    conn = connection;

    conn.on('open', () => {
        if (myRole === 'X') {
            // Host: enter multiplayer, start game, send initial state to joiner
            enterMultiplayerMode('X');
            resetGame();
            conn.send({ type: 'init', starterPlayer: currentPlayer });
        } else {
            setMpStatus('Connected! Waiting for game start...', 'connected');
        }
    });

    conn.on('data', (data) => {
        switch (data.type) {
            case 'init':
                if (!isValidPlayerSymbol(data.starterPlayer)) break;
                enterMultiplayerMode('O');
                resetGame();
                currentPlayer = data.starterPlayer;
                updateStatus(getTurnMessage(), currentPlayer);
                setActivePlayerHighlight();
                updateUndoButtonState();
                break;
            case 'move':
                if (typeof data.index === 'number' && data.index >= 0 && data.index <= 8 && Number.isInteger(data.index)) {
                    makeMove(data.index, currentPlayer);
                }
                break;
            case 'reset':
                if (!isValidPlayerSymbol(data.starterPlayer)) break;
                resetGame();
                currentPlayer = data.starterPlayer;
                updateStatus(getTurnMessage(), currentPlayer);
                setActivePlayerHighlight();
                break;
            case 'reset-scores':
                scores.X = 0;
                scores.O = 0;
                scores.draw = 0;
                updateScoreDisplay();
                break;
        }
    });

    conn.on('close', () => {
        if (multiplayerMode) {
            multiplayerMode = false;
            myRole = null;
            conn = null;
            mpBtn.textContent = 'Multiplayer';
            modeBtn.disabled = false;
            updateNameDisplay();
            resetGame();
            updateStatus('Opponent disconnected. Playing locally.', null);
        }
    });

    conn.on('error', (err) => {
        setMpStatus(`Connection error: ${err.type}`, 'error');
        document.getElementById('mp-join').disabled = false;
    });
}

mpBtn.addEventListener('click', () => {
    if (multiplayerMode) {
        exitMultiplayerMode();
    } else {
        openMultiplayerLobby();
    }
});

document.getElementById('mp-close').addEventListener('click', closeMultiplayerLobby);

mpOverlay.addEventListener('click', (e) => {
    if (e.target === mpOverlay) closeMultiplayerLobby();
});

document.getElementById('mp-create').addEventListener('click', () => {
    destroyPeer();
    mpLobby.classList.add('hidden');
    mpWaiting.classList.remove('hidden');
    mpRoomCode.textContent = '—';
    mpHint.textContent = 'Connecting to server...';
    setMpStatus('');
    document.getElementById('mp-copy').disabled = true;

    const roomCode = generateRoomCode();
    peer = new Peer(roomCode);

    peer.on('open', (id) => {
        myRole = 'X';
        mpRoomCode.textContent = id;
        mpHint.textContent = 'Waiting for opponent to join...';
        document.getElementById('mp-copy').disabled = false;
    });

    peer.on('connection', (connection) => {
        if (conn) {
            connection.close(); // reject — already have a connection
            return;
        }
        mpHint.textContent = 'Opponent connected!';
        setupConnHandlers(connection);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            // Collision on short code — retry with a new one
            peer.destroy();
            document.getElementById('mp-create').click();
            return;
        }
        setMpStatus(`Error: ${err.type}`, 'error');
        mpLobby.classList.remove('hidden');
        mpWaiting.classList.add('hidden');
    });
});

document.getElementById('mp-join').addEventListener('click', () => {
    const code = mpCodeInput.value.trim().toUpperCase();
    if (!code) return;

    const joinBtn = document.getElementById('mp-join');
    joinBtn.disabled = true;
    destroyPeer();
    setMpStatus('Connecting...', '');
    myRole = 'O';

    peer = new Peer();

    peer.on('open', () => {
        const connection = peer.connect(code, { reliable: true });
        setupConnHandlers(connection);
    });

    peer.on('error', (err) => {
        setMpStatus(`Error: ${err.type}`, 'error');
        myRole = null;
        document.getElementById('mp-join').disabled = false;
    });
});

document.getElementById('mp-copy').addEventListener('click', () => {
    const code = mpRoomCode.textContent;
    if (code && code !== '—') {
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('mp-copy');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
    }
});

// Init
updateNameDisplay();
updateScoreDisplay();
resetGame();
