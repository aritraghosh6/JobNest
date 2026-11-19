const mongoose = require('mongoose');

/** A job seeker following a company (employer user). Used for "new job" notifications. */
const followSchema = new mongoose.Schema(
  {
    seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

followSchema.index({ seeker: 1, employer: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema, 'follows');
