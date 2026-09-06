require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { rehydratePendingJobs } = require('./src/services/scheduler');
const cpuMonitor = require('./src/services/cpuMonitor');
const wsServer = require('./src/services/wsServer');

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB(process.env.MONGO_URI);
  await rehydratePendingJobs();
  cpuMonitor.start();

  // Using an explicit http.Server (rather than app.listen directly) so the
  // WebSocket server (live CPU% feed at /ws/system) can attach to the same
  // underlying server and port instead of needing one of its own.
  const httpServer = http.createServer(app);
  wsServer.attach(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (pid=${process.pid})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
