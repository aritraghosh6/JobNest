const mongoose = require('mongoose');
const fileSchema = require('./fileSchema');
const { CULTURE_TAGS, COMPANY_SIZES, VERIFICATION_STATUSES } = require('../config/constants');

const employerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    company_name: { type: String, required: [true, 'Company name is required'], trim: true, maxlength: 120 },
    industry: { type: String, required: [true, 'Industry is required'], trim: true, maxlength: 80 },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 100 },
    website: { type: String, trim: true },
    founded_year: { type: Number, min: 1800, max: new Date().getFullYear() },
    contact_designation: { type: String, trim: true, maxlength: 80 },
    contact_phone: { type: String, trim: true, match: [/^[+]?[\d\s-]{7,15}$/, 'Please enter a valid phone number'] },
    company_size: { type: String, enum: COMPANY_SIZES },
    company_description: {
      type: String,
      required: [true, 'Company description is required'],
      trim: true,
      minlength: [30, 'Company description must be at least 30 characters'],
      maxlength: 2000,
    },
    culture_description: { type: String, trim: true, maxlength: 2000 },
    values: [String],
    culture_tags: [{ type: String, enum: CULTURE_TAGS }],
    job_preferences: {
      required_skills: {
        type: [String],
        validate: {
          validator: (arr) => Array.isArray(arr) && arr.length > 0,
          message: 'Add at least one skill you are looking for',
        },
      },
      salary_range: { type: String, trim: true, maxlength: 60 },
    },
    logo: fileSchema,
    // Set when this account joined a company someone else registered (points to that company's main profile)
    joined_company: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
    joined_company_name: { type: String, trim: true, maxlength: 120 },
    // Normalised company name, used to find existing companies and stop duplicates
    company_key: { type: String, index: true },
    verification: {
      status: { type: String, enum: VERIFICATION_STATUSES, default: 'not_submitted' },
      registration_number: { type: String, trim: true, maxlength: 50 },
      document: fileSchema,
      submitted_at: Date,
      reviewed_at: Date,
      reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      review_note: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true }
);

// No "next" parameter: newer Mongoose versions don't pass one to pre hooks
employerProfileSchema.pre('validate', function setCompanyKey() {
  // Required lazily to avoid a circular import
  const { companyKey } = require('../services/companyGroup');
  this.company_key = companyKey(this.company_name);
});

module.exports = mongoose.model('EmployerProfile', employerProfileSchema, 'employerprofiles');
