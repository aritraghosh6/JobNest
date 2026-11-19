const mongoose = require('mongoose');

/**
 * The single MongoDB connection for the whole backend.
 * Every model uses this connection automatically through mongoose.
 */
async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('MongoDB connection failed. Is MongoDB running and is MONGO_URI correct?');
    throw err;
  }
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

module.exports = { connectDB };
