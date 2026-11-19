/**
 * Saves every collection of the JobNest database into ONE file, so it can be loaded on another laptop.
 * No extra tools needed (uses the mongoose that the backend already has).
 *
 * Usage (from the backend folder):
 *   node scripts/exportDb.js                      -> saves to Desktop\jobnest-data.json
 *   node scripts/exportDb.js D:\somewhere\file.json
 *
 * The file contains user accounts (with hashed passwords). Never commit it or share it publicly.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;
const outFile = process.argv[2] || path.join(os.homedir(), 'Desktop', 'jobnest-data.json');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  const data = {};
  for (const name of collections) {
    data[name] = await db.collection(name).find({}).toArray();
    console.log(`  ${name}: ${data[name].length} document(s)`);
  }

  // Extended JSON keeps ObjectIds and Dates exactly as they are
  fs.writeFileSync(outFile, EJSON.stringify(data, null, 0, { relaxed: false }));
  console.log(`\nSaved ${collections.length} collections to ${outFile}`);
}

main()
  .catch((err) => {
    console.error('Export failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
