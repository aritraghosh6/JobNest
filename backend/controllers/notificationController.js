const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertValidId } = require('../utils/validators');
const { NOTIFICATION_CATEGORIES } = require('../config/constants');

/** Unread counts for the bell: total plus one per filter tab. Only the logged-in user's notifications. */
async function unreadCounts(userId) {
  const rows = await Notification.aggregate([
    { $match: { user: userId, read: false } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const byType = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const sum = (types) => types.reduce((total, t) => total + (byType[t] || 0), 0);
  return {
    unread: rows.reduce((total, r) => total + r.count, 0),
    unread_by_category: {
      messages: sum(NOTIFICATION_CATEGORIES.messages),
      jobs: sum(NOTIFICATION_CATEGORIES.jobs),
      applications: sum(NOTIFICATION_CATEGORIES.applications),
    },
  };
}

// GET /api/v1/notifications?unread=true&category=messages|jobs|applications&limit=20
const list = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.read = false;
  const { category } = req.query;
  if (category && category !== 'all') {
    if (!NOTIFICATION_CATEGORIES[category]) throw new AppError(400, 'Unknown notification category.');
    filter.type = { $in: NOTIFICATION_CATEGORIES[category] };
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const [notifications, counts] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-dedupe_key -group_key'),
    unreadCounts(req.user._id),
  ]);
  res.json({ notifications, ...counts });
});

// GET /api/v1/notifications/unread-count
const unreadCount = asyncHandler(async (req, res) => {
  res.json(await unreadCounts(req.user._id));
});

// PATCH /api/v1/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'notification id');
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found.');
  res.json({ notification: n });
});

// PATCH /api/v1/notifications/read-all?category=messages|jobs|applications
const markAllRead = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id, read: false };
  const { category } = req.query;
  if (category && category !== 'all') {
    if (!NOTIFICATION_CATEGORIES[category]) throw new AppError(400, 'Unknown notification category.');
    filter.type = { $in: NOTIFICATION_CATEGORIES[category] };
  }
  const result = await Notification.updateMany(filter, { read: true });
  res.json({ message: 'All notifications marked as read.', updated: result.modifiedCount });
});

// DELETE /api/v1/notifications/:id
const remove = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'notification id');
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Notification removed.' });
});

module.exports = { list, unreadCount, markRead, markAllRead, remove };
