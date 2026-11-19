const mongoose = require('mongoose');

/**
 * One pending password-reset code per email address AND account type
 * (one email can have a job seeker and an employer account, each with its own password).
 * Only a hash of the code is stored. MongoDB deletes each document once it expires.
 */
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true },
    code_hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    last_sent_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
passwordResetSchema.index({ email: 1, role: 1 }, { unique: true, name: 'email_role_unique' });

module.exports = mongoose.model('PasswordReset', passwordResetSchema, 'passwordresets');
