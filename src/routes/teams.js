const express = require('express');
const auth = require('../middleware/auth');
const Team = require('../models/Team');

const router = express.Router();

// ── List user's teams ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const teams = await Team.find({ user_id: req.user.id })
      .sort({ created_at: -1 });
    res.json(teams);
  } catch (error) {
    console.error('Fetch teams error:', error);
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

// ── List a specific user's teams (for battles) ────────────────
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const teams = await Team.find({ user_id: req.params.userId })
      .sort({ created_at: -1 });
    
    // For battles, we might need a count etc, but since it's embedded, it's already there
    const teamsWithCount = teams.map(t => ({
      ...t.toObject(),
      id: t._id, // compatibility
      pokemon_count: t.pokemon.length
    }));

    res.json(teamsWithCount);
  } catch (error) {
    console.error('Fetch user teams error:', error);
    res.status(500).json({ error: 'Error al obtener equipos del usuario' });
  }
});

// ── Create team ───────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nombre del equipo requerido' });
  }

  try {
    const team = new Team({
      user_id: req.user.id,
      name,
      pokemon: []
    });
    await team.save();
    res.status(201).json({ id: team._id, name: team.name, pokemon: [] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Error al crear equipo' });
  }
});

// ── Update team name ──────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const team = await Team.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { name },
      { new: true }
    );

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json({ message: 'Equipo actualizado', team });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar equipo' });
  }
});

// ── Delete team ───────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json({ message: 'Equipo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

// ── Add pokemon to team ───────────────────────────────────────
router.post('/:id/pokemon', auth, async (req, res) => {
  const { pokemon_id } = req.body;
  try {
    const team = await Team.findOne({ _id: req.params.id, user_id: req.user.id });

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    if (team.pokemon.length >= 6) {
      return res.status(400).json({ error: 'El equipo ya tiene 6 pokémon' });
    }

    if (team.pokemon.some(p => p.pokemon_id === pokemon_id)) {
      return res.status(409).json({ error: 'Este pokémon ya está en el equipo' });
    }

    // Find next available slot
    const usedSlots = team.pokemon.map(p => p.slot);
    let nextSlot = 1;
    while (usedSlots.includes(nextSlot)) nextSlot++;

    team.pokemon.push({ pokemon_id, slot: nextSlot });
    await team.save();

    res.status(201).json({ message: 'Pokémon agregado al equipo', slot: nextSlot });
  } catch (error) {
    console.error('Add pokemon error:', error);
    res.status(500).json({ error: 'Error al agregar pokémon' });
  }
});

// ── Remove pokemon from team ──────────────────────────────────
router.delete('/:id/pokemon/:pokemonId', auth, async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, user_id: req.user.id });

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const initialLength = team.pokemon.length;
    team.pokemon = team.pokemon.filter(p => p.pokemon_id !== parseInt(req.params.pokemonId));

    if (team.pokemon.length === initialLength) {
      return res.status(404).json({ error: 'Pokémon no encontrado en el equipo' });
    }

    await team.save();
    res.json({ message: 'Pokémon removido del equipo' });
  } catch (error) {
    res.status(500).json({ error: 'Error al remover pokémon' });
  }
});

module.exports = router;
