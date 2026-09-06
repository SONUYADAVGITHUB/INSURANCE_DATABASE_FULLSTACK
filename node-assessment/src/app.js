// Registers every Mongoose model before anything else runs. Without this,
// populate() on fields whose model was never require()'d directly by a
// controller throws MissingSchemaError (this bit Category/Carrier here -
// see models/index.js and the README for the full story).
require('./models');

const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./routes/upload.routes');
const policyRoutes = require('./routes/policy.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const cpuMonitor = require('./services/cpuMonitor');

const app = express();

// The Angular dev server (localhost:4200) and the API (localhost:3000) are
// different origins, so the browser blocks the response unless the API
// sends CORS headers back. CORS_ORIGIN is configurable via .env; defaults
// to the Angular dev server's default port.
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', pid: process.pid }));

// Task 2.1 visibility: this process's own CPU reading, for dashboards/UIs.
// The supervisor's restart decision is made independently (see supervisor.js) -
// this endpoint only reports, it never restarts anything itself.
// For a live-updating view, see the WebSocket feed at /ws/system (wsServer.js).
app.get('/api/system/status', (req, res) => res.json(cpuMonitor.getStatus()));

app.use('/api/upload', uploadRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/messages', scheduleRoutes);

// Central error handler - catches anything thrown/rejected in the routes above.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
