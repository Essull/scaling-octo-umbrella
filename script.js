const rows = 6;
const columns = 7;
let currentPlayer = 'red';
let board = Array.from({ length: rows }, () => Array(columns).fill(null));

const gameBoard = document.getElementById('game-board');
const resetButton = document.getElementById('reset');

function createBoard() {
    gameBoard.innerHTML = '';
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', handleCellClick);
            gameBoard.appendChild(cell);
        }
    }
}

function handleCellClick(event) {
    const col = event.target.dataset.col;
    for (let row = rows - 1; row >= 0; row--) {
        if (!board[row][col]) {
            board[row][col] = currentPlayer;
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            cell.classList.add(currentPlayer);
            if (checkWin(row, col)) {
                setTimeout(() => alert(`${currentPlayer.toUpperCase()} wins!`), 100);
            }
            currentPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
            return;
        }
    }
}

function checkWin(row, col) {
    return (
        checkDirection(row, col, 1, 0) ||  // Vertical
        checkDirection(row, col, 0, 1) ||  // Horizontal
        checkDirection(row, col, 1, 1) ||  // Diagonal (down-right)
        checkDirection(row, col, 1, -1)    // Diagonal (down-left)
    );
}

function checkDirection(row, col, dRow, dCol) {
    let count = 1;  // Start with the current piece
    count += countInDirection(row, col, dRow, dCol);
    count += countInDirection(row, col, -dRow, -dCol);
    return count >= 4;
}

function countInDirection(row, col, dRow, dCol) {
    let count = 0;
    let r = row + dRow;
    let c = col + dCol;
    while (r >= 0 && r < rows && c >= 0 && c < columns && board[r][c] === currentPlayer) {
        count++;
        r += dRow;
        c += dCol;
    }
    return count;
}

resetButton.addEventListener('click', resetGame);

function resetGame() {
    board = Array.from({ length: rows }, () => Array(columns).fill(null));
    currentPlayer = 'red';
    createBoard();
}

createBoard();
