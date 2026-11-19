const mongoose = require('mongoose');
const { CULTURE_TAGS, EMPLOYMENT_TYPES } = require('../config/constants');

const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const jobSchema = new mongoose.Schema(
  {
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employer_profile: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
    company_name: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Job title is required'], trim: true, maxlength: 120 },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      minlength: [50, 'Job description must be at least 50 characters'],
      maxlength: 5000,
    },
    skills_required: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Add at least one required skill',
      },
    },
    qualifications: { type: String, trim: true, maxlength: 1000 },
    experience_min: { type: Number, min: 0, max: 40, default: 0 },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 100 },
    employment_type: {
      type: String,
      enum: { values: EMPLOYMENT_TYPES, message: 'Invalid employment type' },
      required: [true, 'Employment type is required'],
    },
    is_remote: { type: Boolean, default: false },
    salary_min: { type: Number, required: [true, 'Minimum salary is required'], min: 0 },
    salary_max: {
      type: Number,
      required: [true, 'Maximum salary is required'],
      min: 0,
      validate: {
        validator(value) {
          // "this" is the document on save; skip on update queries
          return typeof this.salary_min !== 'number' || value >= this.salary_min;
        },
        message: 'Maximum salary must be greater than or equal to minimum salary',
      },
    },
    culture_tags: [{ type: String, enum: CULTURE_TAGS }],
    application_deadline: Date,
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    // Why a job was closed: by the employer, because the applicant limit was reached, or because it was filled
    closed_reason: { type: String, enum: ['manual', 'limit_reached', 'filled'] },
    // Optional cap on the number of applications (e.g. 50)
    max_applicants: { type: Number, min: 1, max: 10000 },
    filled_at: Date,
    deadline_reminder_sent: { type: Boolean, default: false },
    // Admin moderation: removed jobs are hidden from everyone except admins and the owner
    moderation_status: { type: String, enum: ['active', 'removed'], default: 'active' },
    moderation_note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

jobSchema.virtual('salary_range').get(function salaryRange() {
  if (typeof this.salary_min !== 'number' || typeof this.salary_max !== 'number') return undefined;
  return `${formatINR(this.salary_min)} - ${formatINR(this.salary_max)}`;
});

jobSchema.index({ title: 'text', description: 'text', skills_required: 'text' });

module.exports = mongoose.model('Job', jobSchema, 'jobs');
