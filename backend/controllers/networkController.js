const User = require('../models/User');
const Connection = require('../models/Connection');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const { assertValidId, cleanString } = require('../utils/validators');
const { buildUserCards } = require('../services/userCards');

const NETWORK_ROLES = [ROLES.JOB_SEEKER, ROLES.EMPLOYER];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function relationFor(connection, myId) {
  if (!connection) return { status: 'none' };
  if (connection.status === 'accepted') return { status: 'connected', connection_id: connection._id };
  if (connection.status === 'pending') {
    return {
      status: String(connection.requester) === String(myId) ? 'pending_sent' : 'pending_received',
      connection_id: connection._id,
    };
  }
  return { status: 'none' }; // rejected requests can be sent again
}

// GET /api/v1/users/discover?q=&role=
const discoverUsers = asyncHandler(async (req, res) => {
  const filter = { _id: { $ne: req.user._id }, is_active: true, role: { $in: NETWORK_ROLES } };
  const q = cleanString(req.query.q, 60);
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  if (NETWORK_ROLES.includes(req.query.role)) filter.role = req.query.role;

  const users = await User.find(filter).select('name role').sort({ createdAt: -1 }).limit(30);
  const keys = users.map((u) => Connection.pairKey(req.user._id, u._id));
  const connections = await Connection.find({ pair_key: { $in: keys } });
  const byKey = new Map(connections.map((c) => [c.pair_key, c]));
  const cards = await buildUserCards(users);

  res.json({
    users: cards.map((card) => ({
      ...card,
      connection: relationFor(byKey.get(Connection.pairKey(req.user._id, card.id)), req.user._id),
    })),
  });
});

// GET /api/v1/connections
const getConnections = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const all = await Connection.find({
    $or: [{ requester: me }, { recipient: me }],
    status: { $in: ['pending', 'accepted'] },
  }).sort({ updatedAt: -1 });

  const otherIds = all.map((c) => (String(c.requester) === String(me) ? c.recipient : c.requester));
  const users = await User.find({ _id: { $in: otherIds }, is_active: true }).select('name role');
  const cards = new Map((await buildUserCards(users)).map((c) => [String(c.id), c]));

  const shape = (c) => {
    const otherId = String(c.requester) === String(me) ? c.recipient : c.requester;
    const user = cards.get(String(otherId));
    return user ? { id: c._id, status: c.status, since: c.responded_at || c.createdAt, user } : null;
  };

  res.json({
    connections: all.filter((c) => c.status === 'accepted').map(shape).filter(Boolean),
    incoming: all.filter((c) => c.status === 'pending' && String(c.recipient) === String(me)).map(shape).filter(Boolean),
    outgoing: all.filter((c) => c.status === 'pending' && String(c.requester) === String(me)).map(shape).filter(Boolean),
  });
});

// POST /api/v1/connections   body: { user_id }
const sendRequest = asyncHandler(async (req, res) => {
  const { user_id: userId } = req.body;
  if (!userId) throw new AppError(400, 'Please choose a user to connect with (user_id is required).');
  assertValidId(userId, 'user id');
  if (String(userId) === String(req.user._id)) throw new AppError(400, 'You cannot connect with yourself.');

  const target = await User.findOne({ _id: userId, is_active: true, role: { $in: NETWORK_ROLES } });
  if (!target) throw new AppError(404, 'User not found.');

  const pairKey = Connection.pairKey(req.user._id, userId);
  const existing = await Connection.findOne({ pair_key: pairKey });
  if (existing?.status === 'accepted') throw new AppError(409, 'You are already connected with this user.');
  if (existing?.status === 'pending') {
    throw new AppError(
      409,
      String(existing.requester) === String(req.user._id)
        ? 'Connection request already sent.'
        : 'This user has already sent you a request. Accept it from your requests list.'
    );
  }

  let connection;
  if (existing) {
    // A previously rejected request can be sent again
    existing.set({ requester: req.user._id, recipient: userId, status: 'pending', responded_at: undefined });
    connection = await existing.save();
  } else {
    connection = await Connection.create({ requester: req.user._id, recipient: userId, pair_key: pairKey });
  }
  res.status(200).json({ message: 'Connection request sent successfully', connection_id: connection._id });
});

// PATCH /api/v1/connections/:id   body: { action: "accept" | "reject" }
const respondToRequest = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'connection id');
  const { action } = req.body;
  if (!['accept', 'reject'].includes(action)) throw new AppError(400, 'Action must be accept or reject.');
  const connection = await Connection.findById(req.params.id);
  if (!connection) throw new AppError(404, 'Connection request not found.');
  if (String(connection.recipient) !== String(req.user._id)) throw new AppError(403, 'Only the recipient can respond to this request.');
  if (connection.status !== 'pending') throw new AppError(409, 'This request has already been answered.');
  connection.status = action === 'accept' ? 'accepted' : 'rejected';
  connection.responded_at = new Date();
  await connection.save();
  res.json({ message: action === 'accept' ? 'Connection accepted' : 'Connection request declined' });
});

// DELETE /api/v1/connections/:id   (cancel a sent request or remove a connection)
const removeConnection = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'connection id');
  const connection = await Connection.findById(req.params.id);
  if (!connection) throw new AppError(404, 'Connection not found.');
  const me = String(req.user._id);
  if (String(connection.requester) !== me && String(connection.recipient) !== me) {
    throw new AppError(403, 'You are not part of this connection.');
  }
  await connection.deleteOne();
  res.json({ message: connection.status === 'accepted' ? 'Connection removed' : 'Request cancelled' });
});

module.exports = { discoverUsers, getConnections, sendRequest, respondToRequest, removeConnection };
