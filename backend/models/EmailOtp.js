const mongoose = require("mongoose");

/**
 * One pending sign-up verification code per email address.
 * Only a hash of the code is stored, never the code itself.
 * MongoDB deletes each document automatically once it expires (TTL index).
 */
const emailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code_hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    last_sent_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

emailOtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("EmailOtp", emailOtpSchema, "emailotps");
