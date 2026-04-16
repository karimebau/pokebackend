const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { activeBattles, processTurn } = require('../services/battleEngine');
const Battle = require('../models/Battle');

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
      const { opponentId, teamMeta } = data;
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

    // ── Turn-based Battle Actions ─────────────────────────────────────
    socket.on('submit_action', async (data) => {
      const { battleId, moveIndex } = data;
      const state = activeBattles.get(battleId);
      
      if (!state) {
        return socket.emit('battle_error', { error: 'Batalla no encontrada o ya finalizada.' });
      }

      // Identify player
      const isP1 = String(state.challengerId) === String(socket.user.id);
      const isP2 = String(state.opponentId) === String(socket.user.id);
      if (!isP1 && !isP2) return;

      const pStateStr = isP1 ? 'p1' : 'p2';
      const activePoke = isP1 ? state.t1Pokemon[state.t1Index] : state.t2Pokemon[state.t2Index];
      const move = activePoke.moves[moveIndex];

      if (!move) return socket.emit('battle_error', { error: 'Movimiento no válido.' });

      // Save action
      state.actionsQueue[pStateStr] = move;

      // Both players submitted?
      if (state.actionsQueue.p1 && state.actionsQueue.p2) {
        const p1Move = state.actionsQueue.p1;
        const p2Move = state.actionsQueue.p2;
        state.actionsQueue = { p1: null, p2: null }; // reset for next turn

        const turnLog = processTurn(state, p1Move, p2Move);

        const turnPayload = {
          turnNumber: state.turn,
          log: turnLog,
          p1Active: state.t1Pokemon[state.t1Index],
          p2Active: state.t2Pokemon[state.t2Index],
          winner: state.winner
        };

        const sock1 = connectedUsers.get(String(state.challengerId));
        const sock2 = connectedUsers.get(String(state.opponentId));

        if (sock1) io.to(sock1).emit('battle_turn_result', turnPayload);
        if (sock2) io.to(sock2).emit('battle_turn_result', turnPayload);

        // If game ended, save to DB and cleanup
        if (state.winner) {
          try {
            const winnerId = state.winner === 1 ? state.challengerId : state.winner === 2 ? state.opponentId : null;
            const winnerEmail = state.winner === 1 ? state.p1Username : state.winner === 2 ? state.p2Username : null; // Close enough

            await Battle.findByIdAndUpdate(state.dbId, {
              winner_id: winnerId,
              winner_email: winnerEmail,
              log: state.log // save entire history
            });
            activeBattles.delete(battleId);
          } catch (e) {
            console.error('Error saving final battle state:', e);
          }
        }
      } else {
        // Notify the opponent that we are waiting for them
        const opponentId = isP1 ? state.opponentId : state.challengerId;
        const opponentSock = connectedUsers.get(String(opponentId));
        if (opponentSock) {
           io.to(opponentSock).emit('battle_opponent_ready');
        }
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