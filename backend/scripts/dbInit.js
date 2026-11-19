/**
 * Creates every JobNest collection and its indexes WITHOUT inserting any documents,
 * then prints how many documents each collection holds.
 * Safe to run any time: it never inserts, deletes or changes documents or collections.
 * The only indexes it removes are the old unique "email" indexes on users and passwordresets
 * (see dropOldEmailIndex).
 *
 * Usage (from the backend folder):  npm run db:init
 * The backend (bin/www) also runs this automatically every time it starts.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const models = require('../models');

/**
 * Older databases have a unique index on email alone, which blocks the same email from
 * having both a job seeker and an employer account (and its own reset code). Remove it once;
 * the models now use a unique (email, role) index instead.
 */
async function dropOldEmailIndex(existing) {
  // users: one account per email -> one per email per role
  // passwordresets: one reset code per email -> one per email per role
  for (const name of ['users', 'passwordresets']) {
    if (!existing.has(name)) continue;
    const col = mongoose.connection.db.collection(name);
    // eslint-disable-next-line no-await-in-loop
    const old = (await col.indexes()).find((i) => i.name === 'email_1' && i.unique);
    if (old) {
      // eslint-disable-next-line no-await-in-loop
      await col.dropIndex('email_1');
      console.log(`Removed the old one-per-email index from ${name} (now one per email per account type).`);
    }
  }
}

/**
 * Deadlines used to be saved as midnight (UTC) of the chosen day, which closed jobs at the start
 * of their last day. Move those to the end of the same day. Runs on every start; only touches
 * deadlines that are still exactly midnight UTC, so it is harmless to repeat.
 */
async function fixMidnightDeadlines(existing) {
  if (!existing.has('jobs')) return;
  const jobs = mongoose.connection.db.collection('jobs');
  const list = await jobs.find({ application_deadline: { $type: 'date' } }).project({ application_deadline: 1 }).toArray();
  const ops = [];
  for (const j of list) {
    const d = j.application_deadline;
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
      const end = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
      ops.push({ updateOne: { filter: { _id: j._id }, update: { $set: { application_deadline: end } } } });
    }
  }
  if (ops.length) {
    await jobs.bulkWrite(ops);
    console.log(`Moved ${ops.length} job deadline(s) to the end of their day.`);
  }
}

async function initDatabase({ quiet = false } = {}) {
  const existing = new Set((await mongoose.connection.db.listCollections().toArray()).map((c) => c.name));
  await dropOldEmailIndex(existing);
  await fixMidnightDeadlines(existing);
  const rows = [];
  for (const [name, Model] of Object.entries(models)) {
    const collection = Model.collection.collectionName;
    if (!existing.has(collection)) await Model.createCollection();
    await Model.createIndexes(); // adds missing indexes only (unique email, job+applicant, etc.)
    rows.push({ model: name, collection, documents: await Model.countDocuments() });
  }
  if (!quiet) {
    console.log(`\nDatabase: ${mongoose.connection.name}`);
    console.table(rows);
  }
  return rows;
}

if (require.main === module) {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing. Create backend/.env from backend/.env.example.');
    process.exit(1);
  }
  connectDB()
    .then(() => initDatabase())
    .then(() => console.log('All collections and indexes are ready.'))
    .catch((err) => {
      console.error('Database initialisation failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { initDatabase };
