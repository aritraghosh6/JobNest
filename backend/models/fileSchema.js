const mongoose = require('mongoose');

// Metadata for an uploaded file. The file itself lives in backend/uploads.
const fileSchema = new mongoose.Schema(
  {
    stored_name: String,
    original_name: String,
    mimetype: String,
    size: Number,
    uploaded_at: Date,
  },
  { _id: false }
);

module.exports = fileSchema;
