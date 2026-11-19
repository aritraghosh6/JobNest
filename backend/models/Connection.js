const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    // Both user ids sorted and joined, so A→B and B→A can never both exist
    pair_key: { type: String, required: true, unique: true },
    responded_at: Date,
  },
  { timestamps: true }
);

connectionSchema.statics.pairKey = (a, b) => [String(a), String(b)].sort().join('_');

module.exports = mongoose.model('Connection', connectionSchema, 'connections');
