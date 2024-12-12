const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const neo4j = require('neo4j-driver');
const path = require("path");
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const cors = require('cors');
const { error } = require('console');
const { name } = require('ejs');

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cookieParser());
app.use(cors());
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
const driver = neo4j.driver(
  'bolt://localhost:7687', // Make sure your Neo4j server is running on this port
  neo4j.auth.basic('neo4j', 'rootroot')
);
var  session = driver.session();


app.get('/game', function (req, res)
{
    res.render('game.ejs');
});

app.get('/login', function (req, res)
{
    res.render('login.ejs');
});

app.get('/register', function (req, res)
{
    res.render('register.ejs');
});

const users = {
  admin: 'password123',
  user1: 'mypassword'
};

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Validation
  if (!username || !password) {
      return res.status(400).send('Username and password are required');
  }
  const query = ` Match (p:Player) where p.username = $username and p.passowrd = $password return p`;

  const parameters = {
    username: username,
    password: hashString(password)
  };
  session.run(query, parameters)
  .then(result => {
    result.records.forEach(record => {
      if (record.get('p').properties.passowrd == parameters.password) {
      // Set a cookie named 'loggedIn' to true
      res.cookie('loggedIn321', username, { // For security, can't be accessed via JavaScript
          maxAge: 60 * 60 * 1000, // 1 hour expiration
      });

      res.status(200).send('Login successful');
  } else {
      res.status(401).send('Invalid username or password');
  }
    })
  }).catch(error =>{
    res.status(401).send('Invalid username or password');
  })
});

function hashString(inputString) {
  const hash = crypto.createHash('sha256');  // Create a SHA-256 hash object
  hash.update(inputString);  // Update the hash with the input string
  return hash.digest('hex');  // Return the hash as a hexadecimal string
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Validation (basic example)
  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }
  if (password.length > 40) {
    return res.status(400).send('Password too long');
  }
  if (username.length > 40) {
    return res.status(400).send('Username too long');
  }

  // Neo4j query to check if the username already exists
  const checkSession = driver.session(); // Open a session for the "check" query
  const checkQuery = 'MATCH (p:Player) WHERE p.username = $username RETURN p';
  const checkParams = { username };

  try {
    const checkResult = await checkSession.run(checkQuery, checkParams);
    if (checkResult.records.length > 0) {
      return res.status(400).send('Username already exists');
    }
  } catch (error) {
    console.error('Error checking username:', error);
    return res.status(500).send('Server error');
  } finally {
    await checkSession.close(); // Close the session for the "check" query
  }

  // Create the new user
  const createSession = driver.session(); // Open a new session for the "create" query
  const createQuery = 'CREATE (p:Player {username: $username, passowrd: $password}) RETURN p';
  const createParams = {
    username,
    password: hashString(password),
  };

  try {
    const createResult = await createSession.run(createQuery, createParams);
    const singleRecord = createResult.records[0];
    const personNode = singleRecord.get('p');
    res.status(201).send('Registration successful');
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).send('Error creating user');
  } finally {
    await createSession.close(); // Close the session for the "create" query
  }
});


app.get('/', function(req, res){
  res.render('index.ejs');
});

function checkWin(board, playerColor) {
    // Check horizontal, vertical, and diagonal directions for a sequence of 4 pieces
    const directions = [
      { r: 0, c: 1 },  // Horizontal (left to right)
      { r: 1, c: 0 },  // Vertical (top to bottom)
      { r: 1, c: 1 },  // Diagonal (top-left to bottom-right)
      { r: 1, c: -1 }, // Diagonal (top-right to bottom-left)
    ];
  
    // Iterate through every cell in the board
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        // If the current cell contains the player's piece, check all directions
        if (board[row][col] === playerColor) {
          for (let dir of directions) {
            let count = 1;
            
            // Check in the positive direction (right, down, diagonally)
            for (let i = 1; i < 4; i++) {
              const newRow = row + dir.r * i;
              const newCol = col + dir.c * i;
              if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === playerColor) {
                count++;
              } else {
                break;
              }
            }
  
            // Check in the negative direction (left, up, diagonally)
            for (let i = 1; i < 4; i++) {
              const newRow = row - dir.r * i;
              const newCol = col - dir.c * i;
              if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === playerColor) {
                count++;
              } else {
                break;
              }
            }
  
            // If we find four consecutive pieces, it's a win
            if (count >= 4) {
              return true;
            }
          }
        }
      }
    }
    return false; // No winner found
  }

// Create an empty board (6 rows, 7 columns)
function createEmptyBoard() {
  const rows = 6;
  const cols = 7;
  const board = Array(rows).fill().map(() => Array(cols).fill(null));
  return board;
}

// Store game state (board, players, and current turn) in a Map, indexed by roomId
const rooms = new Map();

io.on('connection', (socket) => {

  // Handle room joining
  socket.on('joinRoom', (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        board: createEmptyBoard(),
        players: [],
        currentTurn: 'red',  // 'red' starts the game
      });

      playerColor = 'red';
    } else {
        playerColor = 'yellow';
    }

    const room = rooms.get(roomId);

    // Check if the room already has two players
    if (room.players.length < 2) {
      room.players.push({ id: socket.id, color: playerColor });
      socket.join(roomId);

      // Send the initial board state and whose turn it is
      socket.emit('roomJoined', room.board, playerColor);
      socket.emit('turn', room.currentTurn);

      // Notify other players that a new player has joined
      socket.to(roomId).emit('playerJoined', playerColor);

      // If both players are in the room, let them know the game can start
      if (room.players.length === 2) {
        io.to(roomId).emit('gameState', room.board);
      }
    } else {
      socket.emit('gameFull', 'Room is full. Please try another one.');
    }
  });

  io.on('connection', function(socket) {
    const _id = socket.id
    socket.on('disconnect', function() {
        io.emit('userLeft', {message: _id + ' left the room'})
        })
    })

    // Broadcast when a user connects
  socket.broadcast.emit('message2', 'A new user has joined the chat');

  // Listen for chat messages
  socket.on('chatMessage2', (msg, usern) => {
    io.emit('message2', msg, usern); // Broadcast the message to all users
  });

  // Broadcast when a user disconnects
  socket.on('disconnect', () => {
    io.emit('message2', 'A user has left the chat');
  });

  // Handle game reset
    socket.on('resetGame', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
        // Reset the board and the turn
        room.board = createEmptyBoard();
        room.currentTurn = 'red';  // Red player starts the new game
    
        // Emit the reset game state to both players
        io.to(roomId).emit('gameState', createEmptyBoard());
        io.to(roomId).emit('turn', room.currentTurn);
    
        // Optionally, notify players about the reset
  // Notify players of the new turn
        }
    });


  // Handle making a move
  socket.on('makeMove', (roomId, col) => {
    const room = rooms.get(roomId);
    if (room) {
      const currentPlayer = room.players.find(p => p.id === socket.id);
      if (currentPlayer && currentPlayer.color === room.currentTurn) {
        const row = room.board.findIndex(r => r[col] === null);
        if (row !== -1) {
          room.board[row][col] = currentPlayer.color;
          io.to(roomId).emit('gameState', room.board);
  
          // Check if the current player has won
          if (checkWin(room.board, currentPlayer.color)) {
            session.run(query, parameters)
            io.to(roomId).emit('gameOver', `${currentPlayer.color.charAt(0).toUpperCase() + currentPlayer.color.slice(1)} wins!`);
          } else {
            // Switch turns if no one has won
            room.currentTurn = room.currentTurn === 'red' ? 'yellow' : 'red';
            io.to(roomId).emit('turn', room.currentTurn); // Notify players of the new turn
          }
        }
      } else {
        socket.emit('notYourTurn', 'It\'s not your turn yet!');
      }
    }
  });
  
  // Handle receiving chat messages from a player
socket.on('sendChatMessage', (message, roomId, playerColor) => {
    // Emit the message with the player's color to all players in the room
    io.to(roomId).emit('chatMessage', message, playerColor); // Send the message with color
  });
  

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up any game state if necessary
  });

  socket.on('resetGame', (roomId) => {
    io.to(roomId).emit('resetGame');
  });
  
});


const port = process.env.PORT ||
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

