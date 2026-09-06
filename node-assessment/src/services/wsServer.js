const { WebSocketServer } = require('ws');
const cpuMonitor = require('./cpuMonitor');

/**
 * Attaches a WebSocket server at /ws/system to an existing http.Server.
 * Every time cpuMonitor takes a new CPU reading, it's broadcast to every
 * connected client as JSON - this is what the Angular sidebar's live
 * CPU% pill subscribes to, instead of polling GET /api/system/status.
 */
function attach(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/system' });

  wss.on('connection', (ws) => {
    // Send the current reading immediately so the client doesn't wait
    // up to CPU_SAMPLE_INTERVAL_MS for its first data point.
    ws.send(JSON.stringify(cpuMonitor.getStatus()));

    ws.on('error', () => {
      // Swallow - a dead/broken client socket shouldn't crash the server.
    });
  });

  cpuMonitor.on('sample', (status) => {
    const payload = JSON.stringify(status);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  });

  return wss;
}

module.exports = { attach };
