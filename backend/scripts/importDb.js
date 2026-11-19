/**
 * Loads a file made by exportDb.js into this laptop's JobNest database.
 * WARNING: it REPLACES the data in every collection that is in the file.
 *
 * Usage (from the backend folder):
 *   node scripts/importDb.js --yes                      -> reads Desktop\jobnest-data.json
 *   node scripts/importDb.js D:\somewhere\file.json --yes
 *
 * Without --yes it only shows what it would load and changes nothing.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;
const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const inFile = args.find((a) => a !== '--yes') || path.join(os.homedir(), 'Desktop', 'jobnest-data.json');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in backend/.env');
  if (!fs.existsSync(inFile)) throw new Error(`File not found: ${inFile}`);

  const data = EJSON.parse(fs.readFileSync(inFile, 'utf8'), { relaxed: false });
  const names = Object.keys(data);

  console.log(`File: ${inFile}`);
  names.forEach((name) => console.log(`  ${name}: ${data[name].length} document(s)`));

  if (!confirmed) {
    console.log('\nNothing changed. Run again with --yes to replace this laptop\'s data with the file.');
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const name of names) {
    const col = db.collection(name);
    await col.deleteMany({}); // keeps the collection and its indexes
    if (data[name].length) await col.insertMany(data[name], { ordered: false });
    console.log(`  loaded ${name}`);
  }
  console.log(`\nDone: ${names.length} collections loaded into ${mongoose.connection.name}. Restart the backend.`);
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
