const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema({
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

FriendRequestSchema.index({ sender_id: 1, receiver_id: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);
