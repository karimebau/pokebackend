const axios = require('axios');

const POKEAPI = process.env.POKEAPI_BASE || 'https://pokeapi.co/api/v2';

// In-memory cache to avoid hitting PokeAPI rate limits
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function cachedGet(url) {
  const now = Date.now();
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (now - timestamp < CACHE_TTL) return data;
  }
  const { data } = await axios.get(url);
  cache.set(url, { data, timestamp: now });
  return data;
}

// ── Get paginated pokemon list ────────────────────────────────
async function getPokemonList(limit = 20, offset = 0) {
  const data = await cachedGet(`${POKEAPI}/pokemon?limit=${limit}&offset=${offset}`);
  const pokemonDetails = await Promise.all(
    data.results.map(async (p) => {
      const detail = await cachedGet(p.url);
      return {
        id: detail.id,
        name: detail.name,
        sprite: detail.sprites.other?.['official-artwork']?.front_default 
          || detail.sprites.front_default,
        types: detail.types.map(t => t.type.name),
        stats: detail.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
      };
    })
  );
  return { count: data.count, pokemon: pokemonDetails };
}

// ── Get detailed pokemon info ─────────────────────────────────
async function getPokemonDetail(idOrName) {
  const pokemon = await cachedGet(`${POKEAPI}/pokemon/${idOrName}`);
  const species = await cachedGet(`${POKEAPI}/pokemon-species/${pokemon.id}`);
  
  // Get evolution chain
  let evolutionChain = [];
  try {
    const evoData = await cachedGet(species.evolution_chain.url);
    evolutionChain = parseEvolutionChain(evoData.chain);
  } catch (e) {
    evolutionChain = [];
  }

  // Get flavor text in Spanish or English
  const flavorEntry = species.flavor_text_entries.find(e => e.language.name === 'es')
    || species.flavor_text_entries.find(e => e.language.name === 'en')
    || species.flavor_text_entries[0];

  const genusEntry = species.genera.find(g => g.language.name === 'es')
    || species.genera.find(g => g.language.name === 'en');

  return {
    id: pokemon.id,
    name: pokemon.name,
    sprite: pokemon.sprites.other?.['official-artwork']?.front_default 
      || pokemon.sprites.front_default,
    sprites: {
      front: pokemon.sprites.front_default,
      back: pokemon.sprites.back_default,
      artwork: pokemon.sprites.other?.['official-artwork']?.front_default,
    },
    types: pokemon.types.map(t => t.type.name),
    stats: pokemon.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
    height: pokemon.height,
    weight: pokemon.weight,
    abilities: pokemon.abilities.map(a => ({
      name: a.ability.name,
      hidden: a.is_hidden,
    })),
    moves: pokemon.moves.slice(0, 4).map(m => m.move.name),
    species: {
      genus: genusEntry?.genus || '',
      flavor_text: flavorEntry?.flavor_text?.replace(/[\n\f]/g, ' ') || '',
      generation: species.generation?.name || '',
      habitat: species.habitat?.name || '',
      is_legendary: species.is_legendary,
      is_mythical: species.is_mythical,
    },
    evolution_chain: evolutionChain,
  };
}

// ── Parse evolution chain recursively ─────────────────────────
function parseEvolutionChain(chain) {
  const result = [];
  let current = chain;

  while (current) {
    const speciesName = current.species.name;
    const speciesId = extractIdFromUrl(current.species.url);
    result.push({
      name: speciesName,
      id: speciesId,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`,
    });

    if (current.evolves_to && current.evolves_to.length > 0) {
      current = current.evolves_to[0];
    } else {
      current = null;
    }
  }

  return result;
}

function extractIdFromUrl(url) {
  const parts = url.split('/').filter(Boolean);
  return parseInt(parts[parts.length - 1]);
}

// ── Get pokemon by type ───────────────────────────────────────
async function getPokemonByType(typeName) {
  const data = await cachedGet(`${POKEAPI}/type/${typeName}`);
  return data.pokemon.map(p => ({
    name: p.pokemon.name,
    id: extractIdFromUrl(p.pokemon.url),
  }));
}

// ── Get pokemon by generation/region ──────────────────────────
async function getPokemonByGeneration(genId) {
  const data = await cachedGet(`${POKEAPI}/generation/${genId}`);
  return data.pokemon_species.map(p => ({
    name: p.name,
    id: extractIdFromUrl(p.url),
  }));
}

// ── Get type list ─────────────────────────────────────────────
async function getTypeList() {
  const data = await cachedGet(`${POKEAPI}/type`);
  return data.results
    .filter(t => !['unknown', 'shadow', 'stellar'].includes(t.name))
    .map(t => t.name);
}

// ── Get generation list ───────────────────────────────────────
async function getGenerationList() {
  const data = await cachedGet(`${POKEAPI}/generation`);
  return data.results.map((g, i) => ({
    id: i + 1,
    name: g.name,
  }));
}

// ── Get pokemon for battle (with attacks and stats) ───────────
async function getPokemonForBattle(pokemonId) {
  const pokemon = await cachedGet(`${POKEAPI}/pokemon/${pokemonId}`);
  
  // Pick 4 moves (prefer damage moves)
  const movesToFetch = pokemon.moves.slice(0, 8);
  const moves = [];
  
  for (const m of movesToFetch) {
    try {
      const moveData = await cachedGet(m.move.url);
      if (moveData.power && moveData.power > 0) {
        moves.push({
          name: moveData.name,
          power: moveData.power,
          type: moveData.type.name,
          accuracy: moveData.accuracy || 100,
          damage_class: moveData.damage_class.name,
        });
      }
      if (moves.length >= 4) break;
    } catch (e) { /* skip */ }
  }

  // If less than 4 moves, add a default tackle
  while (moves.length < 4) {
    moves.push({
      name: 'tackle',
      power: 40,
      type: 'normal',
      accuracy: 100,
      damage_class: 'physical',
    });
  }

  return {
    id: pokemon.id,
    name: pokemon.name,
    sprite: pokemon.sprites.other?.['official-artwork']?.front_default 
      || pokemon.sprites.front_default,
    types: pokemon.types.map(t => t.type.name),
    stats: {
      hp: pokemon.stats[0].base_stat,
      attack: pokemon.stats[1].base_stat,
      defense: pokemon.stats[2].base_stat,
      'special-attack': pokemon.stats[3].base_stat,
      'special-defense': pokemon.stats[4].base_stat,
      speed: pokemon.stats[5].base_stat,
    },
    moves: moves,
  };
}

module.exports = {
  getPokemonList,
  getPokemonDetail,
  getPokemonByType,
  getPokemonByGeneration,
  getTypeList,
  getGenerationList,
  getPokemonForBattle,
};
