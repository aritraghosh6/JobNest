const mongoose = require('mongoose');
const fileSchema = require('./fileSchema');
const { APPLICATION_STATUSES, INTERVIEW_MODES } = require('../config/constants');

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cover_letter_text: { type: String, trim: true, maxlength: 2000 },
    // Copy of the profile resume at the time of applying
    resume: fileSchema,
    match_score: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted' },
    status_history: [
      {
        status: { type: String, enum: APPLICATION_STATUSES },
        changed_at: { type: Date, default: Date.now },
        changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true, maxlength: 500 },
        // Optional details for assessment / interview steps
        stage_label: { type: String, trim: true, maxlength: 80 }, // e.g. "Technical interview - round 1"
        scheduled_at: Date, // interview date and time, or assessment due date
        mode: { type: String, enum: INTERVIEW_MODES },
        location: { type: String, trim: true, maxlength: 300 }, // address or meeting link
        _id: false,
      },
    ],
    confirmation_email: {
      status: { type: String, enum: ['sent', 'logged', 'failed'] },
      sent_at: Date,
    },
  },
  { timestamps: true }
);

// One application per seeker per job
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema, 'applications');
