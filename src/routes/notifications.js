const express = require('express');
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// ── List user's notifications ─────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ── Mark notification as read ─────────────────────────────────
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const result = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { read: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});

// ── Mark all as read ──────────────────────────────────────────
router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ user_id: req.user.id }, { read: true });
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar todas como leídas' });
  }
});

// ── Delete notification ───────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });

    if (!result) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

module.exports = router;
