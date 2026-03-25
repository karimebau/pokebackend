const express = require('express');
const auth = require('../middleware/auth');
const pokeapi = require('../services/pokeapi');

const router = express.Router();

// ── List pokemon with pagination and filters ──────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, name, type1, type2, generation } = req.query;

    // If searching by name, use direct lookup
    if (name) {
      try {
        const pokemon = await pokeapi.getPokemonDetail(name.toLowerCase());
        return res.json({ count: 1, pokemon: [pokemon] });
      } catch (e) {
        return res.json({ count: 0, pokemon: [] });
      }
    }

    // If filtering by type(s)
    if (type1 || type2) {
      let pokemonIds = null;

      if (type1) {
        const byType1 = await pokeapi.getPokemonByType(type1);
        pokemonIds = new Set(byType1.map(p => p.id));
      }

      if (type2) {
        const byType2 = await pokeapi.getPokemonByType(type2);
        const type2Ids = new Set(byType2.map(p => p.id));

        if (pokemonIds) {
          // Intersection: pokemon that have BOTH types
          pokemonIds = new Set([...pokemonIds].filter(id => type2Ids.has(id)));
        } else {
          pokemonIds = type2Ids;
        }
      }

      // Fetch details for filtered pokemon (paginated)
      const allIds = [...pokemonIds].sort((a, b) => a - b);
      const paginatedIds = allIds.slice(Number(offset), Number(offset) + Number(limit));

      const pokemon = await Promise.all(
        paginatedIds.map(async (id) => {
          try {
            const detail = await pokeapi.getPokemonDetail(id);
            return {
              id: detail.id,
              name: detail.name,
              sprite: detail.sprite,
              types: detail.types,
              stats: detail.stats,
            };
          } catch (e) {
            return null;
          }
        })
      );

      return res.json({
        count: allIds.length,
        pokemon: pokemon.filter(Boolean),
      });
    }

    // If filtering by generation/region
    if (generation) {
      const byGen = await pokeapi.getPokemonByGeneration(generation);
      const sortedIds = byGen.map(p => p.id).sort((a, b) => a - b);
      const paginatedIds = sortedIds.slice(Number(offset), Number(offset) + Number(limit));

      const pokemon = await Promise.all(
        paginatedIds.map(async (id) => {
          try {
            const detail = await pokeapi.getPokemonDetail(id);
            return {
              id: detail.id,
              name: detail.name,
              sprite: detail.sprite,
              types: detail.types,
              stats: detail.stats,
            };
          } catch (e) {
            return null;
          }
        })
      );

      return res.json({
        count: sortedIds.length,
        pokemon: pokemon.filter(Boolean),
      });
    }

    // Default: paginated list
    const data = await pokeapi.getPokemonList(Number(limit), Number(offset));
    res.json(data);
  } catch (error) {
    console.error('Error fetching pokemon:', error.message);
    res.status(500).json({ error: 'Error al obtener pokémon' });
  }
});

// ── Get pokemon detail ────────────────────────────────────────
router.get('/types', auth, async (req, res) => {
  try {
    const types = await pokeapi.getTypeList();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipos' });
  }
});

router.get('/generations', auth, async (req, res) => {
  try {
    const generations = await pokeapi.getGenerationList();
    res.json(generations);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener generaciones' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const pokemon = await pokeapi.getPokemonDetail(req.params.id);
    res.json(pokemon);
  } catch (error) {
    console.error('Error fetching pokemon detail:', error.message);
    res.status(404).json({ error: 'Pokémon no encontrado' });
  }
});

module.exports = router;
