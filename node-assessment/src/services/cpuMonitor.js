/**
 * Self-reported CPU usage for GET /api/system/status and the live
 * WebSocket feed (see wsServer.js).
 *
 * This is deliberately separate from supervisor.js's monitoring: the
 * supervisor samples this process from the OUTSIDE (via `pidusage`) and
 * makes the actual restart decision. This module samples the process's
 * OWN `process.cpuUsage()` from the inside, purely to have something to
 * report over HTTP/WebSocket - it never triggers a restart itself.
 *
 * Because of that, the "sustained" streak shown here is informational
 * (matches the supervisor's thresholds so the numbers are comparable),
 * not authoritative - the supervisor may see slightly different values
 * since sampling happens in two separate processes/intervals.
 */
const { EventEmitter } = require('events');

const SAMPLE_INTERVAL_MS = Number(process.env.CPU_SAMPLE_INTERVAL_MS || 2000);
const THRESHOLD = Number(process.env.CPU_RESTART_THRESHOLD || 70);
const SUSTAINED_SAMPLES = Number(process.env.CPU_SUSTAINED_SAMPLES || 5);

const emitter = new EventEmitter();

let lastUsage = process.cpuUsage();
let lastSampleAt = Date.now();
let latestPercent = 0;
let overThresholdStreak = 0;
let timer = null;

function sample() {
  const now = Date.now();
  const elapsedMs = now - lastSampleAt;
  const diff = process.cpuUsage(lastUsage); // {user, system} microseconds since lastUsage

  const usedMs = (diff.user + diff.system) / 1000;
  latestPercent = elapsedMs > 0 ? (usedMs / elapsedMs) * 100 : 0;
  overThresholdStreak = latestPercent >= THRESHOLD ? overThresholdStreak + 1 : 0;

  lastUsage = process.cpuUsage();
  lastSampleAt = now;

  emitter.emit('sample', getStatus());
}

function start() {
  if (timer) return;
  timer = setInterval(sample, SAMPLE_INTERVAL_MS);
  // Don't let this timer keep the process alive on its own.
  if (typeof timer.unref === 'function') timer.unref();
}

function getStatus() {
  return {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    cpuPercent: Number(latestPercent.toFixed(1)),
    restartThreshold: THRESHOLD,
    sustainedSamplesRequired: SUSTAINED_SAMPLES,
    sustainedStreak: overThresholdStreak,
    nearRestart: overThresholdStreak >= SUSTAINED_SAMPLES,
    sampledAt: new Date().toISOString()
  };
}

module.exports = { start, getStatus, on: emitter.on.bind(emitter) };
