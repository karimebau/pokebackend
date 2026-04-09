const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const User = require('../models/User');
const Favorite = require('../models/Favorite');
const Team = require('../models/Team');
const Friend = require('../models/Friend');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');
const Battle = require('../models/Battle');

async function populateEmails() {
  try {
    // 1. Conectar a MongoDB
    // Adjust path if .env is missing or if process.env.MONGODB_URI is not set
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pokedex';
    console.log('🔗 Conectando a MongoDB en:', uri);
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB.');

    // 2. Obtener todos los usuarios como diccionario para búsqueda rápida
    const users = await User.find({}, '_id email');
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u.email;
    });

    console.log(`Buscando en ${users.length} usuarios...`);

    let countFavorites = 0;
    const favorites = await Favorite.find({ user_email: { $exists: false } });
    for (const fav of favorites) {
      if (fav.user_id && userMap[fav.user_id.toString()]) {
        fav.user_email = userMap[fav.user_id.toString()];
        await fav.save();
        countFavorites++;
      }
    }
    console.log(`✅ Favoritos actualizados: ${countFavorites}`);

    let countTeams = 0;
    const teams = await Team.find({ user_email: { $exists: false } });
    for (const team of teams) {
      if (team.user_id && userMap[team.user_id.toString()]) {
        team.user_email = userMap[team.user_id.toString()];
        await team.save();
        countTeams++;
      }
    }
    console.log(`✅ Equipos actualizados: ${countTeams}`);

    let countFriends = 0;
    const friends = await Friend.find({ $or: [{ user_email: { $exists: false } }, { friend_email: { $exists: false } }] });
    for (const friend of friends) {
      let changed = false;
      if (friend.user_id && userMap[friend.user_id.toString()] && !friend.user_email) {
        friend.user_email = userMap[friend.user_id.toString()];
        changed = true;
      }
      if (friend.friend_id && userMap[friend.friend_id.toString()] && !friend.friend_email) {
        friend.friend_email = userMap[friend.friend_id.toString()];
        changed = true;
      }
      if (changed) {
        await friend.save();
        countFriends++;
      }
    }
    console.log(`✅ Amigos actualizados: ${countFriends}`);

    let countFriendRequests = 0;
    const requests = await FriendRequest.find({ $or: [{ sender_email: { $exists: false } }, { receiver_email: { $exists: false } }] });
    for (const req of requests) {
      let changed = false;
      if (req.sender_id && userMap[req.sender_id.toString()] && !req.sender_email) {
        req.sender_email = userMap[req.sender_id.toString()];
        changed = true;
      }
      if (req.receiver_id && userMap[req.receiver_id.toString()] && !req.receiver_email) {
        req.receiver_email = userMap[req.receiver_id.toString()];
        changed = true;
      }
      if (changed) {
        await req.save();
        countFriendRequests++;
      }
    }
    console.log(`✅ Solicitudes de amistad actualizadas: ${countFriendRequests}`);

    let countNotifications = 0;
    const notifications = await Notification.find({ user_email: { $exists: false } });
    for (const notif of notifications) {
      if (notif.user_id && userMap[notif.user_id.toString()]) {
        notif.user_email = userMap[notif.user_id.toString()];
        await notif.save();
        countNotifications++;
      }
    }
    console.log(`✅ Notificaciones actualizadas: ${countNotifications}`);

    let countBattles = 0;
    const battles = await Battle.find({ $or: [{ challenger_email: { $exists: false } }, { opponent_email: { $exists: false } }, { winner_email: { $exists: false } }] });
    for (const b of battles) {
      let changed = false;
      if (b.challenger_id && userMap[b.challenger_id.toString()] && !b.challenger_email) {
        b.challenger_email = userMap[b.challenger_id.toString()];
        changed = true;
      }
      if (b.opponent_id && userMap[b.opponent_id.toString()] && !b.opponent_email) {
        b.opponent_email = userMap[b.opponent_id.toString()];
        changed = true;
      }
      if (b.winner_id && userMap[b.winner_id.toString()] && !b.winner_email) {
        b.winner_email = userMap[b.winner_id.toString()];
        changed = true;
      }
      if (changed) {
        await b.save();
        countBattles++;
      }
    }
    console.log(`✅ Batallas actualizadas: ${countBattles}`);

    console.log('🎉 Migración de correos completada con éxito.');
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  } finally {
    await mongoose.disconnect();
  }
}

populateEmails();
