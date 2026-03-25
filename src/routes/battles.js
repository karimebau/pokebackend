const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db/database');
const pokeapi = require('../services/pokeapi');
const { runBattle } = require('../services/battleEngine');

const router = express.Router();

// ── Start battle ──────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { opponent_id, challenger_team_id, opponent_team_id } = req.body;

    if (!opponent_id || !challenger_team_id || !opponent_team_id) {
      return res.status(400).json({ error: 'opponent_id, challenger_team_id y opponent_team_id son requeridos' });
    }

    // Verify friendship
    const friendship = db.prepare(
      'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?'
    ).get(req.user.id, opponent_id);

    if (!friendship) {
      return res.status(403).json({ error: 'Solo puedes batallar con amigos' });
    }

    // Get challenger team pokemon
    const challengerTeam = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
      .get(challenger_team_id, req.user.id);

    if (!challengerTeam) {
      return res.status(404).json({ error: 'Tu equipo no fue encontrado' });
    }

    // Get opponent team pokemon
    const opponentTeam = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?')
      .get(opponent_team_id, opponent_id);

    if (!opponentTeam) {
      return res.status(404).json({ error: 'El equipo del oponente no fue encontrado' });
    }

    // Get pokemon IDs from both teams
    const challengerPokemonIds = db.prepare(
      'SELECT pokemon_id FROM team_pokemon WHERE team_id = ? ORDER BY slot'
    ).all(challenger_team_id).map(r => r.pokemon_id);

    const opponentPokemonIds = db.prepare(
      'SELECT pokemon_id FROM team_pokemon WHERE team_id = ? ORDER BY slot'
    ).all(opponent_team_id).map(r => r.pokemon_id);

    if (challengerPokemonIds.length === 0 || opponentPokemonIds.length === 0) {
      return res.status(400).json({ error: 'Ambos equipos deben tener al menos un pokémon' });
    }

    // Fetch battle-ready pokemon data from PokeAPI
    const [team1Data, team2Data] = await Promise.all([
      Promise.all(challengerPokemonIds.map(id => pokeapi.getPokemonForBattle(id))),
      Promise.all(opponentPokemonIds.map(id => pokeapi.getPokemonForBattle(id))),
    ]);

    // Run the battle
    const battleResult = runBattle(team1Data, team2Data);

    // Determine winner user ID
    let winnerId = null;
    if (battleResult.winner === 1) winnerId = req.user.id;
    else if (battleResult.winner === 2) winnerId = opponent_id;

    // Save battle to DB
    const result = db.prepare(`
      INSERT INTO battles (challenger_id, opponent_id, challenger_team_id, opponent_team_id, winner_id, log)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, opponent_id,
      challenger_team_id, opponent_team_id,
      winnerId,
      JSON.stringify(battleResult.log)
    );

    res.json({
      id: result.lastInsertRowid,
      winner: battleResult.winner,
      winner_id: winnerId,
      challenger: { id: req.user.id, username: req.user.username, team: team1Data.map(p => ({ id: p.id, name: p.name, sprite: p.sprite })) },
      opponent: {
        id: opponent_id,
        username: db.prepare('SELECT username FROM users WHERE id = ?').get(opponent_id)?.username,
        team: team2Data.map(p => ({ id: p.id, name: p.name, sprite: p.sprite })),
      },
      log: battleResult.log,
    });
  } catch (error) {
    console.error('Error in battle:', error);
    res.status(500).json({ error: 'Error al ejecutar la batalla' });
  }
});

// ── Battle history ────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const battles = db.prepare(`
    SELECT b.*,
      u1.username as challenger_name,
      u2.username as opponent_name,
      t1.name as challenger_team_name,
      t2.name as opponent_team_name,
      uw.username as winner_name
    FROM battles b
    JOIN users u1 ON u1.id = b.challenger_id
    JOIN users u2 ON u2.id = b.opponent_id
    JOIN teams t1 ON t1.id = b.challenger_team_id
    JOIN teams t2 ON t2.id = b.opponent_team_id
    LEFT JOIN users uw ON uw.id = b.winner_id
    WHERE b.challenger_id = ? OR b.opponent_id = ?
    ORDER BY b.created_at DESC
    LIMIT 20
  `).all(req.user.id, req.user.id);

  res.json(battles.map(b => ({
    ...b,
    log: b.log ? JSON.parse(b.log) : [],
  })));
});

module.exports = router;
