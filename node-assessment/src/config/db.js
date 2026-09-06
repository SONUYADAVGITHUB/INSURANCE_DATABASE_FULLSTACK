const mongoose = require('mongoose');

/**
 * Connects to MongoDB. Safe to call from the main process or from a
 * worker thread - each gets its own connection since mongoose connections
 * cannot be shared across worker_threads.
 */
async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    // sensible defaults; mongoose 8 no longer needs useNewUrlParser/useUnifiedTopology
    maxPoolSize: 10
  });

  return mongoose.connection;
}

module.exports = { connectDB };
