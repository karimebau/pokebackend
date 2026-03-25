const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();

// ── List friends ──────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT f.id, f.created_at,
      u.id as friend_user_id, u.username, u.email
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json(friends);
});

// ── Add friend by email ───────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  if (email === req.user.email) {
    return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
  }

  const friend = db.prepare('SELECT id, username, email FROM users WHERE email = ?').get(email);
  if (!friend) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  try {
    // Add bidirectional friendship
    const addFriend = db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)');
    const addFriendTransaction = db.transaction(() => {
      addFriend.run(req.user.id, friend.id);
      addFriend.run(friend.id, req.user.id);
    });
    addFriendTransaction();

    res.status(201).json({ message: 'Amigo agregado', friend });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya son amigos' });
    }
    res.status(500).json({ error: 'Error al agregar amigo' });
  }
});

// ── Remove friend ─────────────────────────────────────────────
router.delete('/:friendId', auth, (req, res) => {
  const friendId = req.params.friendId;

  // Remove bidirectional friendship
  const removeFriend = db.transaction(() => {
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
      .run(req.user.id, friendId);
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
      .run(friendId, req.user.id);
  });
  removeFriend();

  res.json({ message: 'Amigo eliminado' });
});

module.exports = router;
