// ── Type Effectiveness Chart ──────────────────────────────────
// Returns multiplier: 2 = super effective, 0.5 = not very, 0 = immune
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

// ── Damage calculation ────────────────────────────────────────
function calculateDamage(attacker, defender, move) {
  const level = 50; // all pokemon at level 50
  const power = move.power;
  
  // Use physical or special stats based on damage class
  const attackStat = move.damage_class === 'physical' 
    ? attacker.stats.attack 
    : attacker.stats['special-attack'];
  const defenseStat = move.damage_class === 'physical' 
    ? defender.stats.defense 
    : defender.stats['special-defense'];

  // STAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Type effectiveness
  const typeMultiplier = getTypeMultiplier(move.type, defender.types);

  // Random factor (85-100%)
  const random = (Math.random() * 0.15 + 0.85);

  // Standard Pokemon damage formula
  const damage = Math.floor(
    ((((2 * level / 5 + 2) * power * attackStat / defenseStat) / 50) + 2) 
    * stab * typeMultiplier * random
  );

  return { damage: Math.max(1, damage), typeMultiplier };
}

// ── Run a full battle ─────────────────────────────────────────
function runBattle(team1, team2) {
  const log = [];
  let t1Index = 0;
  let t2Index = 0;

  // Clone HP for battle
  const t1Pokemon = team1.map(p => ({ ...p, currentHp: p.stats.hp }));
  const t2Pokemon = team2.map(p => ({ ...p, currentHp: p.stats.hp }));

  log.push({ type: 'start', message: '¡La batalla ha comenzado!' });

  let turn = 0;
  const MAX_TURNS = 100;

  while (t1Index < t1Pokemon.length && t2Index < t2Pokemon.length && turn < MAX_TURNS) {
    turn++;
    const p1 = t1Pokemon[t1Index];
    const p2 = t2Pokemon[t2Index];

    if (turn === 1 || log[log.length - 1]?.type === 'switch') {
      log.push({
        type: 'matchup',
        message: `${p1.name} vs ${p2.name}`,
        pokemon1: { name: p1.name, id: p1.id, hp: p1.currentHp, maxHp: p1.stats.hp },
        pokemon2: { name: p2.name, id: p2.id, hp: p2.currentHp, maxHp: p2.stats.hp },
      });
    }

    // Determine turn order by speed
    const p1First = p1.stats.speed >= p2.stats.speed;
    const first = p1First ? { atk: p1, def: p2, team: 1 } : { atk: p2, def: p1, team: 2 };
    const second = p1First ? { atk: p2, def: p1, team: 2 } : { atk: p1, def: p2, team: 1 };

    // First attack
    const move1 = selectBestMove(first.atk, first.def);
    const result1 = executeAttack(first.atk, first.def, move1, log, turn);

    if (first.def.currentHp <= 0) {
      first.def.currentHp = 0;
      log.push({
        type: 'faint',
        message: `¡${first.def.name} se ha debilitado!`,
        pokemon: first.def.name,
        team: first.team === 1 ? 2 : 1,
      });

      if (first.team === 1) {
        t2Index++;
        if (t2Index < t2Pokemon.length) {
          log.push({ type: 'switch', message: `¡${t2Pokemon[t2Index].name} entra al combate!`, pokemon: t2Pokemon[t2Index].name, team: 2 });
        }
      } else {
        t1Index++;
        if (t1Index < t1Pokemon.length) {
          log.push({ type: 'switch', message: `¡${t1Pokemon[t1Index].name} entra al combate!`, pokemon: t1Pokemon[t1Index].name, team: 1 });
        }
      }
      continue;
    }

    // Second attack
    const move2 = selectBestMove(second.atk, second.def);
    const result2 = executeAttack(second.atk, second.def, move2, log, turn);

    if (second.def.currentHp <= 0) {
      second.def.currentHp = 0;
      log.push({
        type: 'faint',
        message: `¡${second.def.name} se ha debilitado!`,
        pokemon: second.def.name,
        team: second.team === 1 ? 2 : 1,
      });

      if (second.team === 1) {
        t2Index++;
        if (t2Index < t2Pokemon.length) {
          log.push({ type: 'switch', message: `¡${t2Pokemon[t2Index].name} entra al combate!`, pokemon: t2Pokemon[t2Index].name, team: 2 });
        }
      } else {
        t1Index++;
        if (t1Index < t1Pokemon.length) {
          log.push({ type: 'switch', message: `¡${t1Pokemon[t1Index].name} entra al combate!`, pokemon: t1Pokemon[t1Index].name, team: 1 });
        }
      }
    }
  }

  // Determine winner
  let winner;
  if (t1Index >= t1Pokemon.length && t2Index >= t2Pokemon.length) {
    winner = null; // draw
    log.push({ type: 'end', message: '¡La batalla terminó en empate!' });
  } else if (t1Index >= t1Pokemon.length) {
    winner = 2;
    log.push({ type: 'end', message: '¡El Equipo 2 gana la batalla!', winner: 2 });
  } else {
    winner = 1;
    log.push({ type: 'end', message: '¡El Equipo 1 gana la batalla!', winner: 1 });
  }

  return { winner, log };
}

function selectBestMove(attacker, defender) {
  // Pick the move that deals the most estimated damage
  let bestMove = attacker.moves[0];
  let bestDamage = 0;

  for (const move of attacker.moves) {
    const typeMultiplier = getTypeMultiplier(move.type, defender.types);
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const estimated = move.power * stab * typeMultiplier;
    if (estimated > bestDamage) {
      bestDamage = estimated;
      bestMove = move;
    }
  }

  return bestMove;
}

function executeAttack(attacker, defender, move, log, turn) {
  // Accuracy check
  const accuracyRoll = Math.random() * 100;
  if (accuracyRoll > move.accuracy) {
    log.push({
      type: 'miss',
      turn,
      message: `${attacker.name} usó ${move.name} pero falló!`,
      attacker: attacker.name,
      move: move.name,
    });
    return { damage: 0, hit: false };
  }

  const { damage, typeMultiplier } = calculateDamage(attacker, defender, move);
  defender.currentHp -= damage;

  let effectiveness = '';
  if (typeMultiplier >= 2) effectiveness = '¡Es super efectivo!';
  else if (typeMultiplier > 0 && typeMultiplier < 1) effectiveness = 'No es muy efectivo...';
  else if (typeMultiplier === 0) effectiveness = 'No afecta al oponente...';

  log.push({
    type: 'attack',
    turn,
    message: `${attacker.name} usó ${move.name}! ${effectiveness} (-${damage} HP)`,
    attacker: attacker.name,
    defender: defender.name,
    move: move.name,
    damage,
    effectiveness: typeMultiplier,
    defenderHp: Math.max(0, defender.currentHp),
    defenderMaxHp: defender.stats.hp,
  });

  return { damage, hit: true, typeMultiplier };
}

module.exports = { runBattle };
