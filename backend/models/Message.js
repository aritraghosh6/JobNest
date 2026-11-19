const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation_key: { type: String, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    read_at: Date,
  },
  { timestamps: true }
);

messageSchema.index({ conversation_key: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, read_at: 1 });

module.exports = mongoose.model('Message', messageSchema, 'messages');
