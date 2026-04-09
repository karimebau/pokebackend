const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// A mapping to keep track of connected users: userId -> socketId
const connectedUsers = new Map();

let io;

const initSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // ✅ FIX: Railway necesita estas opciones para WebSockets
    transports: ['polling', 'websocket'],
    allowEIO3: true
  });

  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication Error'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication Error'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    // ✅ FIX: guardar siempre como string para evitar type mismatch
    const userId = String(socket.user.id);
    connectedUsers.set(userId, socket.id);
    console.log(`✅ Socket conectado: ${socket.user.username} (${userId})`);

    // Friend Invitation events
    socket.on('send_friend_request', (data) => {
      const recipientSocket = connectedUsers.get(String(data.friendId));
      if (recipientSocket) {
        io.to(recipientSocket).emit('friend_request_received', {
          sender: socket.user.username,
          message: data.message || 'Te ha enviado una solicitud de amistad.'
        });
      }
    });

    // Battle Subsystem
    socket.on('battle_invite', (data) => {
      const { opponentId, teamId, teamMeta } = data;
      // ✅ FIX: normalizar a string al buscar
      const recipientSocket = connectedUsers.get(String(opponentId));

      console.log(`⚔️ battle_invite de ${socket.user.username} a opponentId=${opponentId}`);
      console.log(`   Usuarios conectados:`, [...connectedUsers.keys()]);
      console.log(`   Socket encontrado:`, recipientSocket);

      if (recipientSocket) {
        io.to(recipientSocket).emit('battle_invite_received', {
          challengerId: socket.user.id,
          challengerName: socket.user.username,
          challengerTeamMeta: teamMeta
        });
      } else {
        socket.emit('battle_invite_error', { error: 'El oponente no está conectado' });
      }
    });

    socket.on('battle_accept', (data) => {
      const { challengerId, defenderTeamId } = data;
      // ✅ FIX: normalizar a string
      const challengerSocket = connectedUsers.get(String(challengerId));

      if (challengerSocket) {
        io.to(challengerSocket).emit('battle_accepted', {
          defenderId: socket.user.id,
          defenderTeamId: defenderTeamId
        });
      }
    });

    socket.on('battle_decline', (data) => {
      const { challengerId } = data;
      // ✅ FIX: normalizar a string
      const challengerSocket = connectedUsers.get(String(challengerId));
      if (challengerSocket) {
        io.to(challengerSocket).emit('battle_declined', {
          defenderName: socket.user.username
        });
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      console.log(`❌ Socket desconectado: ${socket.user.username}`);
    });
  });
};

const getIo = () => io;

// ✅ FIX: normalizar a string también aquí
const getSocketId = (userId) => connectedUsers.get(String(userId));

module.exports = { initSockets, getIo, getSocketId };