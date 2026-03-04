const cells = document.querySelectorAll('.cell');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const modeBtn = document.createElement('button');
modeBtn.innerText = 'Switch to AI Mode';
document.getElementById('game').insertBefore(modeBtn, document.getElementById('board'));

let currentPlayer = 'X';
let gameActive = true;
let aiMode = false;
let board = ["", "", "", "", "", "", "", "", ""];

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function handleCellClick(e) {
    const clickedCell = e.target;
    const index = parseInt(clickedCell.getAttribute('data-cell-index'));

    if (board[index] !== "" || !gameActive || (aiMode && currentPlayer === 'O')) return;

    makeMove(index, 'X');
    
    if (aiMode && gameActive) {
        // AI's turn
        setTimeout(aiMove, 500);
    }
}

function makeMove(index, player) {
    board[index] = player;
    cells[index].innerText = player;
    checkResult();
    if(gameActive) currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
}

function aiMove() {
    let emptyIndices = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (emptyIndices.length > 0) {
        let randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(randomIndex, 'O');
    }
}

function checkResult() {
    let roundWon = false;
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        statusDisplay.innerText = `Player ${currentPlayer} wins!`;
        gameActive = false;
        return;
    }

    if (!board.includes("")) {
        statusDisplay.innerText = "Draw!";
        gameActive = false;
    }
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetBtn.addEventListener('click', () => {
    board = ["", "", "", "", "", "", "", "", ""];
    cells.forEach(cell => cell.innerText = "");
    gameActive = true;
    currentPlayer = 'X';
    statusDisplay.innerText = "";
});
modeBtn.addEventListener('click', () => {
    aiMode = !aiMode;
    modeBtn.innerText = aiMode ? 'Switch to Human Mode' : 'Switch to AI Mode';
    resetBtn.click();
});
