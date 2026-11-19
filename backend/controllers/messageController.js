const User = require('../models/User');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertValidId, cleanString } = require('../utils/validators');
const { buildUserCards } = require('../services/userCards');

/** Users may only message people they are connected with. */
async function assertConnected(meId, otherId) {
  const connection = await Connection.findOne({ pair_key: Connection.pairKey(meId, otherId), status: 'accepted' });
  if (!connection) throw new AppError(403, 'You can only message users you are connected with.');
}

// POST /api/v1/messages   body: { recipient_id, message }
const sendMessage = asyncHandler(async (req, res) => {
  const { recipient_id: recipientId } = req.body;
  const text = cleanString(req.body.message, 1000);
  const errors = {};
  if (!recipientId) errors.recipient_id = 'Recipient is required.';
  if (!text) errors.message = 'Message cannot be empty.';
  if (Object.keys(errors).length) throw new AppError(400, 'Please correct the highlighted fields.', errors);
  if (String(req.body.message).trim().length > 1000) throw new AppError(400, 'Message cannot exceed 1000 characters.');
  assertValidId(recipientId, 'recipient id');

  const recipient = await User.findOne({ _id: recipientId, is_active: true });
  if (!recipient) throw new AppError(404, 'Recipient not found.');
  await assertConnected(req.user._id, recipientId);

  const message = await Message.create({
    conversation_key: Connection.pairKey(req.user._id, recipientId),
    sender: req.user._id,
    recipient: recipientId,
    message: text,
  });
  res.status(200).json({ message: 'Message sent successfully', data: message });
});

// GET /api/v1/messages/conversations
const getConversations = asyncHandler(async (req, res) => {
  const me = String(req.user._id);
  const recent = await Message.find({ $or: [{ sender: req.user._id }, { recipient: req.user._id }] })
    .sort({ createdAt: -1 })
    .limit(1000);

  const byOther = new Map();
  for (const m of recent) {
    const otherId = String(m.sender) === me ? String(m.recipient) : String(m.sender);
    if (!byOther.has(otherId)) byOther.set(otherId, { last_message: m, unread: 0 });
    if (String(m.recipient) === me && !m.read_at) byOther.get(otherId).unread += 1;
  }

  const users = await User.find({ _id: { $in: [...byOther.keys()] } }).select('name role');
  const cards = await buildUserCards(users);
  res.json({
    conversations: cards
      .map((user) => {
        const info = byOther.get(String(user.id));
        return {
          user,
          unread: info.unread,
          last_message: {
            message: info.last_message.message,
            createdAt: info.last_message.createdAt,
            from_me: String(info.last_message.sender) === me,
          },
        };
      })
      .sort((a, b) => b.last_message.createdAt - a.last_message.createdAt),
  });
});

// GET /api/v1/messages/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({ recipient: req.user._id, read_at: null });
  res.json({ unread: count });
});

// GET /api/v1/messages/:userId   (conversation with one user; marks their messages as read)
const getThread = asyncHandler(async (req, res) => {
  assertValidId(req.params.userId, 'user id');
  const key = Connection.pairKey(req.user._id, req.params.userId);
  const [other, connection] = await Promise.all([
    User.findById(req.params.userId).select('name role'),
    Connection.findOne({ pair_key: key, status: 'accepted' }),
  ]);
  if (!other) throw new AppError(404, 'User not found.');
  const hasHistory = await Message.exists({ conversation_key: key });
  if (!connection && !hasHistory) throw new AppError(403, 'You can only view conversations with your connections.');

  const messages = await Message.find({ conversation_key: key }).sort({ createdAt: 1 }).limit(500);
  await Message.updateMany({ conversation_key: key, recipient: req.user._id, read_at: null }, { read_at: new Date() });
  const [card] = await buildUserCards([other]);

  res.json({
    user: card,
    can_message: Boolean(connection),
    messages: messages.map((m) => ({
      id: m._id,
      message: m.message,
      from_me: String(m.sender) === String(req.user._id),
      createdAt: m.createdAt,
      read_at: m.read_at,
    })),
  });
});

module.exports = { sendMessage, getConversations, getUnreadCount, getThread };
