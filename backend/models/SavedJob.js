const mongoose = require('mongoose');

/** A job a seeker saved ("showed interest in"). Used for deadline reminders. */
const savedJobSchema = new mongoose.Schema(
  {
    seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  },
  { timestamps: true }
);

savedJobSchema.index({ seeker: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('SavedJob', savedJobSchema, 'savedjobs');
