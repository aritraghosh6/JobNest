const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

/**
 * In-app notifications shown under the bell icon. Old ones are deleted after 90 days.
 *
 * One bell for everything: job/application updates and new messages are all stored here.
 *  - group_key  keeps ONE unread notification per conversation ("msg:<senderId>").
 *               New messages from the same person update it instead of adding more rows.
 *  - dedupe_key stops the same event being notified twice (e.g. a job announced twice).
 */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, trim: true, maxlength: 600 },
    link: { type: String, trim: true, maxlength: 200 }, // page to open, e.g. /applications
    read: { type: Boolean, default: false },
    group_key: { type: String, trim: true, maxlength: 120 },
    dedupe_key: { type: String, trim: true, maxlength: 400 },
    count: { type: Number, default: 1, min: 1 }, // e.g. "3 new messages"
    actor_name: { type: String, trim: true, maxlength: 120 }, // e.g. the message sender
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, group_key: 1, read: 1 });
notificationSchema.index(
  { user: 1, dedupe_key: 1 },
  { unique: true, partialFilterExpression: { dedupe_key: { $type: 'string' } } }
);
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema, 'notifications');
