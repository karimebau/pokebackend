const express = require('express');
const auth = require('../middleware/auth');
const Favorite = require('../models/Favorite');

const router = express.Router();

// ── List favorites ────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user_id: req.user.id })
      .sort({ created_at: -1 });
    res.json(favorites);
  } catch (error) {
    console.error('Fetch favorites error:', error);
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
});

// ── Add favorite ──────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { pokemon_id } = req.body;

  if (!pokemon_id) {
    return res.status(400).json({ error: 'pokemon_id requerido' });
  }

  try {
    const favorite = new Favorite({
      user_id: req.user.id,
      pokemon_id
    });
    await favorite.save();
    res.status(201).json({ message: 'Pokémon agregado a favoritos' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ya está en favoritos' });
    }
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Error al agregar favorito' });
  }
});

// ── Remove favorite ──────────────────────────────────────────
router.delete('/:pokemonId', auth, async (req, res) => {
  try {
    const result = await Favorite.findOneAndDelete({
      user_id: req.user.id,
      pokemon_id: req.params.pokemonId
    });

    if (!result) {
      return res.status(404).json({ error: 'Favorito no encontrado' });
    }

    res.json({ message: 'Favorito eliminado' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

module.exports = router;
