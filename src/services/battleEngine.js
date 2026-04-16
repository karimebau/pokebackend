// ── Type Effectiveness Chart ──────────────────────────────────
const activeBattles = new Map();

const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// ── Status Effects ────────────────────────────────────────────
const STATUS = {
  NONE: null,
  BURN: 'burn',
  POISON: 'poison',
  PARALYZED: 'paralyzed',
  SLEEP: 'sleep',
  FROZEN: 'frozen',
};

function getTypeMultiplier(attackType, defenderTypes) {
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const chart = TYPE_CHART[attackType];
    if (chart && chart[defType] !== undefined) {
      multiplier *= chart[defType];
    }
  }
  return multiplier;
}

// ── Damage calculation (with crits & burn) ─────────────────────
function calculateDamage(attacker, defender, move) {
  const level = 50;
  const power = move.power;

  const attackStat = move.damage_class === 'physical'
    ? attacker.stats.attack
    : attacker.stats['special-attack'];
  const defenseStat = move.damage_class === 'physical'
    ? defender.stats.defense
    : defender.stats['special-defense'];

  // STAB
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Type effectiveness
  const typeMultiplier = getTypeMultiplier(move.type, defender.types);

  // Critical hit: 1/24 chance → ×1.5 damage, ignores defense drops
  const isCritical = Math.random() < (1 / 24);
  const critMultiplier = isCritical ? 1.5 : 1;

  // Burn halves physical attack
  const burnPenalty = (attacker.status === STATUS.BURN && move.damage_class === 'physical') ? 0.5 : 1;

  // Random factor (85-100%)
  const random = (Math.random() * 0.15 + 0.85);

  const damage = Math.floor(
    ((((2 * level / 5 + 2) * power * (attackStat * burnPenalty) / defenseStat) / 50) + 2)
    * stab * typeMultiplier * critMultiplier * random
  );

  return { damage: Math.max(1, damage), typeMultiplier, isCritical };
}

// ── Smart-random move selection ───────────────────────────────
// 70% chance to pick best move, 30% random — adds unpredictability
function selectMove(attacker, defender) {
  if (!attacker.moves || attacker.moves.length === 0) return null;

  const scoredMoves = attacker.moves.map(move => {
    const typeMultiplier = getTypeMultiplier(move.type, defender.types);
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    return { move, score: move.power * stab * typeMultiplier };
  });

  scoredMoves.sort((a, b) => b.score - a.score);

  // 70% use best move, 30% pick randomly
  if (Math.random() < 0.70) {
    return scoredMoves[0].move;
  }
  return scoredMoves[Math.floor(Math.random() * scoredMoves.length)].move;
}

// ── Apply end-of-turn status damage ───────────────────────────
function applyStatusDamage(pokemon, log) {
  if (pokemon.status === STATUS.BURN) {
    const dmg = Math.floor(pokemon.stats.hp / 16);
    pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
    log.push({
      type: 'status_damage',
      message: `🔥 ${pokemon.name} sufre daño por quemadura! (-${dmg} HP)`,
      pokemon: pokemon.name,
      defenderHp: pokemon.currentHp,
      defenderMaxHp: pokemon.stats.hp,
    });
  } else if (pokemon.status === STATUS.POISON) {
    const dmg = Math.floor(pokemon.stats.hp / 8);
    pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
    log.push({
      type: 'status_damage',
      message: `☠️ ${pokemon.name} sufre daño por envenenamiento! (-${dmg} HP)`,
      pokemon: pokemon.name,
      defenderHp: pokemon.currentHp,
      defenderMaxHp: pokemon.stats.hp,
    });
  }
}

// ── Try to apply secondary effects ────────────────────────────
function tryApplySecondaryEffect(move, attacker, defender, log) {
  // Moves that may burn: fire-type physical moves
  if (move.type === 'fire' && move.damage_class === 'physical' && !defender.status && Math.random() < 0.30) {
    defender.status = STATUS.BURN;
    log.push({ type: 'status', message: `🔥 ¡${defender.name} ha sido quemado!`, pokemon: defender.name, status: 'burn' });
  }
  // Moves that may poison: poison-type moves
  if (move.type === 'poison' && !defender.status && Math.random() < 0.30) {
    defender.status = STATUS.POISON;
    log.push({ type: 'status', message: `☠️ ¡${defender.name} ha sido envenenado!`, pokemon: defender.name, status: 'poison' });
  }
  // Moves that may paralyze: electric-type moves
  if (move.type === 'electric' && !defender.status && Math.random() < 0.30) {
    defender.status = STATUS.PARALYZED;
    log.push({ type: 'status', message: `⚡ ¡${defender.name} ha sido paralizado!`, pokemon: defender.name, status: 'paralyzed' });
  }
  // Ice moves may freeze
  if (move.type === 'ice' && !defender.status && Math.random() < 0.10) {
    defender.status = STATUS.FROZEN;
    log.push({ type: 'status', message: `❄️ ¡${defender.name} ha sido congelado!`, pokemon: defender.name, status: 'frozen' });
  }
}

// ── Check if pokemon can attack this turn ──────────────────────
function canAttack(pokemon, log) {
  if (pokemon.status === STATUS.SLEEP) {
    // 33% chance to wake up each turn
    if (Math.random() < 0.33) {
      pokemon.status = STATUS.NONE;
      log.push({ type: 'status', message: `😴 ¡${pokemon.name} se ha despertado!`, pokemon: pokemon.name });
    } else {
      log.push({ type: 'status', message: `😴 ${pokemon.name} está dormido...`, pokemon: pokemon.name });
      return false;
    }
  }
  if (pokemon.status === STATUS.FROZEN) {
    // 20% chance to thaw each turn
    if (Math.random() < 0.20) {
      pokemon.status = STATUS.NONE;
      log.push({ type: 'status', message: `❄️ ¡${pokemon.name} se ha descongelado!`, pokemon: pokemon.name });
    } else {
      log.push({ type: 'status', message: `❄️ ${pokemon.name} está congelado y no puede moverse!`, pokemon: pokemon.name });
      return false;
    }
  }
  if (pokemon.status === STATUS.PARALYZED) {
    // 25% chance of full paralysis
    if (Math.random() < 0.25) {
      log.push({ type: 'status', message: `⚡ ${pokemon.name} está paralizado y no puede moverse!`, pokemon: pokemon.name });
      return false;
    }
  }
  return true;
}

// ── Execute one attack ─────────────────────────────────────────
function executeAttack(attacker, defender, move, log, turn) {
  // Accuracy check
  const accuracyRoll = Math.random() * 100;
  if (accuracyRoll > move.accuracy) {
    log.push({
      type: 'miss',
      turn,
      message: `${attacker.name} usó ${move.name}... ¡pero falló! 😅`,
      attacker: attacker.name,
      move: move.name,
    });
    return { damage: 0, hit: false };
  }

  const { damage, typeMultiplier, isCritical } = calculateDamage(attacker, defender, move);
  defender.currentHp -= damage;

  let effectiveness = '';
  if (typeMultiplier >= 2) effectiveness = '⚡ ¡Es súper efectivo!';
  else if (typeMultiplier > 0 && typeMultiplier < 1) effectiveness = '😶 No es muy efectivo...';
  else if (typeMultiplier === 0) effectiveness = '🛡️ ¡No le afecta!';

  const critText = isCritical ? ' 💥 ¡Golpe crítico!' : '';

  log.push({
    type: 'attack',
    turn,
    message: `${attacker.name} usó ${move.name}!${critText} ${effectiveness} (-${damage} HP)`,
    attacker: attacker.name,
    defender: defender.name,
    move: move.name,
    damage,
    isCritical,
    effectiveness: typeMultiplier,
    defenderHp: Math.max(0, defender.currentHp),
    defenderMaxHp: defender.stats.hp,
  });

  // Try secondary effects
  if (typeMultiplier > 0) {
    tryApplySecondaryEffect(move, attacker, defender, log);
  }

  return { damage, hit: true, typeMultiplier, isCritical };
}

// ── Init a Turn-based Battle ───────────────────────────────────────
function initBattle(team1, team2) {
  const t1Pokemon = team1.map(p => ({ ...p, currentHp: p.stats.hp, status: STATUS.NONE }));
  const t2Pokemon = team2.map(p => ({ ...p, currentHp: p.stats.hp, status: STATUS.NONE }));

  return {
    t1Pokemon,
    t2Pokemon,
    t1Index: 0,
    t2Index: 0,
    turn: 0,
    winner: null,
    _justSwitched: true,
    log: []
  };
}

// ── Process One Turn ──────────────────────────────────────────
function processTurn(state, move1, move2) {
  const turnLog = [];
  state.turn++;
  
  const p1 = state.t1Pokemon[state.t1Index];
  const p2 = state.t2Pokemon[state.t2Index];

  if (state._justSwitched || state.turn === 1) {
    turnLog.push({
      type: 'matchup',
      message: `🆚 ${p1.name} vs ${p2.name}`,
      pokemon1: { name: p1.name, id: p1.id, hp: p1.currentHp, maxHp: p1.stats.hp },
      pokemon2: { name: p2.name, id: p2.id, hp: p2.currentHp, maxHp: p2.stats.hp },
    });
    state._justSwitched = false;
  }

  const p1Speed = p1.stats.speed * (p1.status === STATUS.PARALYZED ? 0.5 : 1);
  const p2Speed = p2.stats.speed * (p2.status === STATUS.PARALYZED ? 0.5 : 1);
  const p1First = p1Speed >= p2Speed;
  
  const first  = p1First ? { atk: p1, def: p2, teamIdx: 1, move: move1 } : { atk: p2, def: p1, teamIdx: 2, move: move2 };
  const second = p1First ? { atk: p2, def: p1, teamIdx: 2, move: move2 } : { atk: p1, def: p2, teamIdx: 1, move: move1 };

  // First attacker's turn
  if (canAttack(first.atk, turnLog) && first.atk.currentHp > 0) {
    if (first.move) executeAttack(first.atk, first.def, first.move, turnLog, state.turn);
  }
  
  // Second attacker's turn (if alive)
  if (second.atk.currentHp > 0 && canAttack(second.atk, turnLog)) {
    if (second.move) executeAttack(second.atk, second.def, second.move, turnLog, state.turn);
  }

  if (p1.currentHp > 0) applyStatusDamage(p1, turnLog);
  if (p2.currentHp > 0) applyStatusDamage(p2, turnLog);

  const handleFaint = (p, teamIdx) => {
    if (p.currentHp <= 0 && !p._fainted) {
      p.currentHp = 0; p._fainted = true;
      turnLog.push({ type: 'faint', message: `💀 ¡${p.name} se ha debilitado!`, pokemon: p.name });
      if (teamIdx === 1) {
        state.t1Index++;
        if (state.t1Index < state.t1Pokemon.length) {
          const nextP = state.t1Pokemon[state.t1Index];
          turnLog.push({ type: 'switch', message: `🔄 ¡${nextP.name} entra al combate!`, pokemon: nextP.name, team: 1 });
          state._justSwitched = true;
        }
      } else {
        state.t2Index++;
        if (state.t2Index < state.t2Pokemon.length) {
          const nextP = state.t2Pokemon[state.t2Index];
          turnLog.push({ type: 'switch', message: `🔄 ¡${nextP.name} entra al combate!`, pokemon: nextP.name, team: 2 });
          state._justSwitched = true;
        }
      }
    }
  };

  handleFaint(p1, 1);
  handleFaint(p2, 2);

  // Check win conditions
  if (state.t1Index >= state.t1Pokemon.length && state.t2Index >= state.t2Pokemon.length) {
    state.winner = 'draw';
    turnLog.push({ type: 'end', message: '🤝 ¡La batalla terminó en empate!' });
  } else if (state.t1Index >= state.t1Pokemon.length) {
    state.winner = 2;
    turnLog.push({ type: 'end', message: '🏆 ¡El Equipo 2 gana la batalla!', winner: 2 });
  } else if (state.t2Index >= state.t2Pokemon.length) {
    state.winner = 1;
    turnLog.push({ type: 'end', message: '🏆 ¡El Equipo 1 gana la batalla!', winner: 1 });
  }

  state.log.push(...turnLog);
  return turnLog;
}

module.exports = { initBattle, processTurn, activeBattles };
