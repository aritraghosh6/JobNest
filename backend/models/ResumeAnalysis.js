const mongoose = require('mongoose');

// Only the analysis result is stored. The resume file and its full text are not saved.
const resumeAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    source: { type: String, enum: ['job', 'custom'], required: true },
    job_title: { type: String, trim: true, maxlength: 150 },
    file_name: { type: String, trim: true, maxlength: 150 },
    file_type: { type: String, enum: ['pdf', 'docx'] },
    word_count: Number,
    overall_score: { type: Number, min: 0, max: 100, required: true },
    breakdown: [
      {
        key: String,
        label: String,
        weight: Number,
        score: Number,
        applicable: Boolean,
        details: String,
        _id: false,
      },
    ],
    matched_skills: [String],
    missing_skills: [String],
    keywords_found: [String],
    keywords_missing: [String],
    experience: {
      required_years: Number,
      detected_years: Number,
    },
    recommendations: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResumeAnalysis', resumeAnalysisSchema, 'atsanalyses');
