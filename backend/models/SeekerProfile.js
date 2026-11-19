const mongoose = require('mongoose');
const fileSchema = require('./fileSchema');
const { EMPLOYMENT_TYPES, CAREER_STATUSES, NOTICE_PERIODS } = require('../config/constants');

const currentYear = new Date().getFullYear();

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: [true, 'Institution is required'], trim: true, maxlength: 150 },
  degree: { type: String, required: [true, 'Degree is required'], trim: true, maxlength: 100 },
  field_of_study: { type: String, trim: true, maxlength: 100 },
  start_year: { type: Number, min: 1950, max: currentYear + 1 },
  end_year: {
    type: Number,
    min: 1950,
    max: currentYear + 8,
    validate: {
      validator(value) {
        return !value || !this.start_year || value >= this.start_year;
      },
      message: 'End year cannot be before start year',
    },
  },
  grade: { type: String, trim: true, maxlength: 30 },
});

const experienceSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 100 },
  organization: { type: String, required: [true, 'Organization is required'], trim: true, maxlength: 150 },
  type: { type: String, enum: ['job', 'internship', 'project'], default: 'job' },
  start_date: Date,
  end_date: {
    type: Date,
    validate: {
      validator(value) {
        return !value || !this.start_date || value >= this.start_date;
      },
      message: 'End date cannot be before start date',
    },
  },
  is_current: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 1000 },
});

const nonEmptyArray = (label) => ({
  validator: (arr) => Array.isArray(arr) && arr.length > 0,
  message: `Add at least one ${label}`,
});

const seekerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    full_name: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 100 },
    phone: { type: String, trim: true, match: [/^[+]?[\d\s-]{7,15}$/, 'Please enter a valid phone number'] },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 100 },
    headline: { type: String, trim: true, maxlength: 120 },
    summary: { type: String, trim: true, maxlength: 1500 },
    current_status: { type: String, enum: CAREER_STATUSES },
    experience_years: { type: Number, min: 0, max: 50 },
    notice_period: { type: String, enum: NOTICE_PERIODS },
    skills: { type: [String], validate: nonEmptyArray('skill') },
    education: [educationSchema],
    experience: [experienceSchema],
    job_preferences: {
      desired_roles: { type: [String], validate: nonEmptyArray('desired role') },
      preferred_locations: [String],
      job_types: {
        type: [{ type: String, enum: EMPLOYMENT_TYPES }],
        validate: nonEmptyArray('job type'),
      },
      expected_salary: { type: Number, min: 0 },
      open_to_remote: { type: Boolean, default: false },
    },
    social_links: {
      linkedin: { type: String, trim: true },
      github: { type: String, trim: true },
      portfolio: { type: String, trim: true },
    },
    resume: fileSchema,
    cover_letter: fileSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeekerProfile', seekerProfileSchema, 'jobseekerprofiles');
