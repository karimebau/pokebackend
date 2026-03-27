const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pokemon_id: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

FavoriteSchema.index({ user_id: 1, pokemon_id: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', FavoriteSchema);
