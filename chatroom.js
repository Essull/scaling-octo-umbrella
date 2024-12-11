const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins (or specify your domain here)
      methods: ['GET', 'POST'], // Allow only GET and POST methods
    },
  });

// Serve the static HTML file
app.use(express.static('public'));

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected');

  // Broadcast when a user connects
  socket.broadcast.emit('message', 'A new user has joined the chat');

  // Listen for chat messages
  socket.on('chatMessage', (msg, usern) => {
    io.emit('message', msg, usern); // Broadcast the message to all users
  });

  // Broadcast when a user disconnects
  socket.on('disconnect', () => {
    io.emit('message', 'A user has left the chat');
  });
});

// Start the server
const PORT = 3005;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
