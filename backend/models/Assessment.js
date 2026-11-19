const mongoose = require('mongoose');

const dimensionScores = {
  collaborative: { type: Number, min: 0, max: 100, required: true },
  structured: { type: Number, min: 0, max: 100, required: true },
  innovative: { type: Number, min: 0, max: 100, required: true },
  fast_paced: { type: Number, min: 0, max: 100, required: true },
  independent: { type: Number, min: 0, max: 100, required: true },
};

const assessmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: [
      {
        question_id: { type: String, required: true },
        value: { type: Number, min: 1, max: 5, required: true },
        _id: false,
      },
    ],
    scores: dimensionScores,
    top_traits: [String],
    summary: String,
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assessment', assessmentSchema, 'assessmentresults');
