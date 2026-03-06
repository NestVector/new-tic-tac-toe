const cells = document.querySelectorAll('.cell');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const resetScoresBtn = document.getElementById('reset-scores');
const modeBtn = document.getElementById('mode');

let currentPlayer = 'X';
let gameActive = true;
let aiMode = false;
let board = ["", "", "", "", "", "", "", "", ""];

const scores = { X: 0, O: 0, draw: 0 };

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function updateStatus(text, type) {
    statusDisplay.textContent = text;
    statusDisplay.className = type ? `status-${type.toLowerCase()}` : '';
}

function handleCellClick(e) {
    const index = parseInt(e.target.getAttribute('data-cell-index'));
    if (board[index] !== "" || !gameActive || (aiMode && currentPlayer === 'O')) return;

    makeMove(index, 'X');

    if (aiMode && gameActive) {
        setTimeout(aiMove, 400);
    }
}

function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase(), 'taken', 'pop');
    cell.addEventListener('animationend', () => cell.classList.remove('pop'), { once: true });

    const result = checkResult();
    if (result === 'win') {
        const winnerLabel = aiMode && player === 'O' ? 'AI' : `Player ${player}`;
        updateStatus(`${winnerLabel} wins!`, player);
        scores[player]++;
        updateScoreDisplay();
        gameActive = false;
    } else if (result === 'draw') {
        updateStatus("It's a draw!", 'draw');
        scores.draw++;
        updateScoreDisplay();
        gameActive = false;
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        const nextLabel = aiMode && currentPlayer === 'O' ? "AI's turn" : `Player ${currentPlayer}'s turn`;
        updateStatus(nextLabel);
    }
}

function aiMove() {
    if (!gameActive) return;
    const emptyIndices = board.map((val, idx) => val === "" ? idx : null).filter(v => v !== null);
    if (emptyIndices.length > 0) {
        const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(idx, 'O');
    }
}

function checkResult() {
    for (const [a, b, c] of winningConditions) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            cells[a].classList.add('winner');
            cells[b].classList.add('winner');
            cells[c].classList.add('winner');
            return 'win';
        }
    }
    if (!board.includes("")) return 'draw';
    return null;
}

function updateScoreDisplay() {
    document.getElementById('score-x').textContent = scores.X;
    document.getElementById('score-o').textContent = scores.O;
    document.getElementById('score-draw').textContent = scores.draw;
}

function resetGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
    gameActive = true;
    currentPlayer = 'X';
    updateStatus("Player X's turn");
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));

resetBtn.addEventListener('click', resetGame);

resetScoresBtn.addEventListener('click', () => {
    scores.X = 0;
    scores.O = 0;
    scores.draw = 0;
    updateScoreDisplay();
    resetGame();
});

modeBtn.addEventListener('click', () => {
    aiMode = !aiMode;
    modeBtn.textContent = aiMode ? 'Switch to Human Mode' : 'Switch to AI Mode';
    const oLabel = document.querySelector('.score-item.score-o .score-label');
    oLabel.textContent = aiMode ? 'AI' : 'Player O';
    resetGame();
});

// Settings
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const settingsPanel = document.getElementById('settings-panel');

function openSettings() {
    settingsOverlay.classList.remove('hidden');
    darkModeToggle.focus();
}

function closeSettings() {
    settingsOverlay.classList.add('hidden');
    settingsBtn.focus();
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
        const focusable = settingsPanel.querySelectorAll('input, button, [tabindex]');
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

darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode', darkModeToggle.checked);
    localStorage.setItem('darkMode', darkModeToggle.checked);
});

// Load saved preferences
if (localStorage.getItem('darkMode') === 'true') {
    darkModeToggle.checked = true;
    document.body.classList.add('dark-mode');
}

// Init status
updateStatus("Player X's turn");
