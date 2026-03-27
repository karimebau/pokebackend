const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Friend = require('../models/Friend');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');
const mailer = require('../services/mailer');

const router = express.Router();

// ── List friends ──────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const friends = await Friend.find({ user_id: req.user.id })
      .populate('friend_id', 'username email')
      .sort({ created_at: -1 });

    const formattedFriends = friends.map(f => ({
      id: f._id,
      created_at: f.created_at,
      friend_user_id: f.friend_id._id,
      username: f.friend_id.username,
      email: f.friend_id.email
    }));

    res.json(formattedFriends);
  } catch (error) {
    console.error('Fetch friends error:', error);
    res.status(500).json({ error: 'Error al obtener amigos' });
  }
});

// ── List pending requests ─────────────────────────────────────
router.get('/requests', auth, async (req, res) => {
  try {
    const incoming = await FriendRequest.find({ receiver_id: req.user.id, status: 'pending' })
      .populate('sender_id', 'username email');
    
    const outgoing = await FriendRequest.find({ sender_id: req.user.id, status: 'pending' })
      .populate('receiver_id', 'username email');

    res.json({
      incoming: incoming.map(r => ({
        id: r._id,
        created_at: r.created_at,
        username: r.sender_id.username,
        email: r.sender_id.email,
        sender_id: r.sender_id._id
      })),
      outgoing: outgoing.map(r => ({
        id: r._id,
        created_at: r.created_at,
        username: r.receiver_id.username,
        email: r.receiver_id.email,
        receiver_id: r.receiver_id._id
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// ── Send friend request ────────────────────
router.post('/', auth, async (req, res) => {
  const { email, user_code } = req.body;

  if (!email && !user_code) {
    return res.status(400).json({ error: 'Email o Código de Entrenador requerido' });
  }

  try {
    let friend;
    if (user_code) {
      friend = await User.findOne({ user_code: user_code.toUpperCase() });
    } else {
      friend = await User.findOne({ email });
    }

    if (!friend) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (friend.email === req.user.email) return res.status(400).json({ error: 'No puedes invitarte a ti mismo' });

    // Check if already friends
    const existingFriend = await Friend.findOne({ user_id: req.user.id, friend_id: friend._id });
    if (existingFriend) return res.status(409).json({ error: 'Ya son amigos' });

    // Check for existing request
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender_id: req.user.id, receiver_id: friend._id },
        { sender_id: friend._id, receiver_id: req.user.id }
      ],
      status: 'pending'
    });
    if (existingRequest) return res.status(409).json({ error: 'Ya existe una solicitud pendiente' });

    const request = new FriendRequest({
      sender_id: req.user.id,
      receiver_id: friend._id
    });
    await request.save();

    // Notification
    const notif = new Notification({
      user_id: friend._id,
      type: 'friend_request',
      message: `${req.user.username} te envió una solicitud de amistad 🌸`
    });
    await notif.save();

    // Email
    await mailer.sendFriendRequestEmail(friend.email, req.user.username);

    res.status(201).json({ message: 'Invitación enviada correctamente' });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ error: 'Error al enviar invitación' });
  }
});

// ── Accept friend request ─────────────────────────────────────
router.post('/requests/:id/accept', auth, async (req, res) => {
  try {
    const request = await FriendRequest.findOne({ _id: req.params.id, receiver_id: req.user.id, status: 'pending' });
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    // Add bidirectional friendship
    await Friend.create([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id }
    ]);

    // Update request
    request.status = 'accepted';
    await request.save();

    // Notification for sender
    const notif = new Notification({
      user_id: request.sender_id,
      type: 'friend_request_accepted',
      message: `${req.user.username} aceptó tu solicitud de amistad 🎉`
    });
    await notif.save();

    res.json({ message: 'Solicitud aceptada' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// ── Reject friend request ─────────────────────────────────────
router.post('/requests/:id/reject', auth, async (req, res) => {
  try {
    const result = await FriendRequest.findOneAndDelete({ _id: req.params.id, receiver_id: req.user.id });
    if (!result) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ message: 'Solicitud rechazada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// ── Remove friend ─────────────────────────────────────────────
router.delete('/:friendId', auth, async (req, res) => {
  try {
    await Friend.deleteMany({
      $or: [
        { user_id: req.user.id, friend_id: req.params.friendId },
        { user_id: req.params.friendId, friend_id: req.user.id }
      ]
    });
    res.json({ message: 'Amigo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar amigo' });
  }
});

module.exports = router;
