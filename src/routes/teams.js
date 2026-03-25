const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();

// ── List user's teams ─────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const teams = db.prepare(
    'SELECT * FROM teams WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);

  // Attach pokemon to each team
  const teamsWithPokemon = teams.map(team => {
    const pokemon = db.prepare(
      'SELECT pokemon_id, slot FROM team_pokemon WHERE team_id = ? ORDER BY slot'
    ).all(team.id);

    return { ...team, pokemon };
  });

  res.json(teamsWithPokemon);
});

// ── List a specific user's teams (for battles) ────────────────
router.get('/user/:userId', auth, (req, res) => {
  const teams = db.prepare(
    'SELECT id, name, created_at FROM teams WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.params.userId);

  // Attach pokemon counts and IDs to each team
  const teamsWithPokemon = teams.map(team => {
    const pokemon = db.prepare(
      'SELECT pokemon_id, slot FROM team_pokemon WHERE team_id = ? ORDER BY slot'
    ).all(team.id);

    return { ...team, pokemon_count: pokemon.length, pokemon };
  });

  res.json(teamsWithPokemon);
});

// ── Create team ───────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nombre del equipo requerido' });
  }

  const result = db.prepare(
    'INSERT INTO teams (user_id, name) VALUES (?, ?)'
  ).run(req.user.id, name);

  res.status(201).json({ id: result.lastInsertRowid, name, pokemon: [] });
});

// ── Update team name ──────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const { name } = req.body;
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }

  if (name) {
    db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(name, team.id);
  }

  res.json({ message: 'Equipo actualizado' });
});

// ── Delete team ───────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }

  db.prepare('DELETE FROM teams WHERE id = ?').run(team.id);
  res.json({ message: 'Equipo eliminado' });
});

// ── Add pokemon to team ───────────────────────────────────────
router.post('/:id/pokemon', auth, (req, res) => {
  const { pokemon_id } = req.body;
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }

  // Check current count
  const count = db.prepare('SELECT COUNT(*) as count FROM team_pokemon WHERE team_id = ?')
    .get(team.id).count;

  if (count >= 6) {
    return res.status(400).json({ error: 'El equipo ya tiene 6 pokémon' });
  }

  // Find next available slot
  const usedSlots = db.prepare('SELECT slot FROM team_pokemon WHERE team_id = ?')
    .all(team.id).map(r => r.slot);
  
  let nextSlot = 1;
  while (usedSlots.includes(nextSlot)) nextSlot++;

  try {
    db.prepare(
      'INSERT INTO team_pokemon (team_id, pokemon_id, slot) VALUES (?, ?, ?)'
    ).run(team.id, pokemon_id, nextSlot);

    res.status(201).json({ message: 'Pokémon agregado al equipo', slot: nextSlot });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Este pokémon ya está en el equipo' });
    }
    res.status(500).json({ error: 'Error al agregar pokémon' });
  }
});

// ── Remove pokemon from team ──────────────────────────────────
router.delete('/:id/pokemon/:pokemonId', auth, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }

  const result = db.prepare(
    'DELETE FROM team_pokemon WHERE team_id = ? AND pokemon_id = ?'
  ).run(team.id, req.params.pokemonId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Pokémon no encontrado en el equipo' });
  }

  res.json({ message: 'Pokémon removido del equipo' });
});

module.exports = router;
