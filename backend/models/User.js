const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    // Not unique on its own: one email may hold one job seeker AND one employer account.
    // The pair (email, role) is unique - see the index below.
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please enter a valid email address'],
    },
    // select: false means the hash is never returned by normal queries
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    is_active: { type: Boolean, default: true },
    // Job seekers must finish the personality assessment before seeing matched jobs (US2)
    assessment_completed: { type: Boolean, default: false },
    profile_completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One account per email per role (e.g. the same person can be a job seeker and an employer)
userSchema.index({ email: 1, role: 1 }, { unique: true, name: 'email_role_unique' });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema, 'users');
