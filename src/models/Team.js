const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user_email: { type: String, required: false },
  name: { type: String, required: true },
  pokemon: [{
    pokemon_id: { type: Number, required: true },
    slot: { type: Number, required: true, min: 1, max: 6 }
  }],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', TeamSchema);
