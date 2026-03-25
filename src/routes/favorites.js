const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();

// ── List favorites ────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const favorites = db.prepare(
    'SELECT pokemon_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);

  res.json(favorites);
});

// ── Add favorite ──────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { pokemon_id } = req.body;

  if (!pokemon_id) {
    return res.status(400).json({ error: 'pokemon_id requerido' });
  }

  try {
    db.prepare(
      'INSERT INTO favorites (user_id, pokemon_id) VALUES (?, ?)'
    ).run(req.user.id, pokemon_id);

    res.status(201).json({ message: 'Pokémon agregado a favoritos' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya está en favoritos' });
    }
    res.status(500).json({ error: 'Error al agregar favorito' });
  }
});

// ── Remove favorite ──────────────────────────────────────────
router.delete('/:pokemonId', auth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND pokemon_id = ?'
  ).run(req.user.id, req.params.pokemonId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Favorito no encontrado' });
  }

  res.json({ message: 'Favorito eliminado' });
});

module.exports = router;
