require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('./db/database');

const authRoutes = require('./routes/auth');
const pokemonRoutes = require('./routes/pokemon');
const favoritesRoutes = require('./routes/favorites');
const teamsRoutes = require('./routes/teams');
const friendsRoutes = require('./routes/friends');
const battlesRoutes = require('./routes/battles');
const notificationsRoutes = require('./routes/notifications');

// ── Env Validation ──────────────────────────────────────────
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI'];
requiredEnv.forEach(env => {
  if (!process.env[env]) {
    console.error(`❌ CRITICAL: Missing environment variable ${env}`);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/battles', battlesRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  // Ensure CORS headers are present even on errors
  res.header('Access-Control-Allow-Origin', '*');
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Pokedex Backend running on http://localhost:${PORT}`);
});
