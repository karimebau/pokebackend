const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Team = require('../models/Team');
const Friend = require('../models/Friend');
const Battle = require('../models/Battle');
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
    const friendship = await Friend.findOne({
      user_id: req.user.id,
      friend_id: opponent_id
    });

    if (!friendship) {
      return res.status(403).json({ error: 'Solo puedes batallar con amigos' });
    }

    // Get challenger team
    const challengerTeam = await Team.findOne({ _id: challenger_team_id, user_id: req.user.id });
    if (!challengerTeam) return res.status(404).json({ error: 'Tu equipo no fue encontrado' });

    // Get opponent team
    const opponentTeam = await Team.findOne({ _id: opponent_team_id, user_id: opponent_id });
    if (!opponentTeam) return res.status(404).json({ error: 'El equipo del oponente no fue encontrado' });

    if (challengerTeam.pokemon.length === 0 || opponentTeam.pokemon.length === 0) {
      return res.status(400).json({ error: 'Ambos equipos deben tener al menos un pokémon' });
    }

    // Fetch battle-ready pokemon data from PokeAPI
    const [team1Data, team2Data] = await Promise.all([
      Promise.all(challengerTeam.pokemon.sort((a,b) => a.slot - b.slot).map(p => pokeapi.getPokemonForBattle(p.pokemon_id))),
      Promise.all(opponentTeam.pokemon.sort((a,b) => a.slot - b.slot).map(p => pokeapi.getPokemonForBattle(p.pokemon_id))),
    ]);

    // Run the battle
    const battleResult = runBattle(team1Data, team2Data);

    // Determine winner user ID
    let winnerId = null;
    if (battleResult.winner === 1) winnerId = req.user.id;
    else if (battleResult.winner === 2) winnerId = opponent_id;

    // Save battle to DB
    const battle = new Battle({
      challenger_id: req.user.id,
      opponent_id,
      challenger_team_id,
      opponent_team_id,
      winner_id: winnerId,
      log: battleResult.log
    });
    await battle.save();

    const opponentUser = await User.findById(opponent_id);

    res.json({
      id: battle._id,
      winner: battleResult.winner,
      winner_id: winnerId,
      challenger: { 
        id: req.user.id, 
        username: req.user.username, 
        team: team1Data.map(p => ({ id: p.id, name: p.name, sprite: p.sprite })) 
      },
      opponent: {
        id: opponent_id,
        username: opponentUser?.username,
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
router.get('/', auth, async (req, res) => {
  try {
    const battles = await Battle.find({
      $or: [{ challenger_id: req.user.id }, { opponent_id: req.user.id }]
    })
    .populate('challenger_id', 'username')
    .populate('opponent_id', 'username')
    .populate('challenger_team_id', 'name')
    .populate('opponent_team_id', 'name')
    .populate('winner_id', 'username')
    .sort({ created_at: -1 })
    .limit(20);

    res.json(battles.map(b => ({
      id: b._id,
      created_at: b.created_at,
      challenger_name: b.challenger_id.username,
      opponent_name: b.opponent_id.username,
      challenger_team_name: b.challenger_team_id?.name || 'Equipo eliminado',
      opponent_team_name: b.opponent_team_id?.name || 'Equipo eliminado',
      winner_id: b.winner_id?._id,
      winner_name: b.winner_id?.username || 'Empate/Desconocido',
      log: b.log
    })));
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
