/**
 * Task 2.1 - restarts the server once its CPU usage crosses 70% and
 * stays there, rather than reacting to a single brief spike.
 *
 * A Node process can't reliably restart itself from inside its own event
 * loop, so this supervisor runs as a small parent process: it forks
 * server.js as a child, samples the child's CPU usage on an interval via
 * `pidusage`, and kills+respawns the child once the usage has stayed at
 * or above the threshold for N consecutive samples.
 *
 * Run with: npm run supervise
 */
require('dotenv').config();

const { fork } = require('child_process');
const path = require('path');
const pidusage = require('pidusage');

const SERVER_PATH = path.join(__dirname, 'server.js');

const THRESHOLD = Number(process.env.CPU_RESTART_THRESHOLD || 70);
const SAMPLE_INTERVAL_MS = Number(process.env.CPU_SAMPLE_INTERVAL_MS || 2000);
const SUSTAINED_SAMPLES = Number(process.env.CPU_SUSTAINED_SAMPLES || 5);

let child;
let sampleTimer;
let overThresholdStreak = 0;

function startChild() {
  overThresholdStreak = 0;
  child = fork(SERVER_PATH);
  console.log(`[supervisor] started server pid=${child.pid}`);

  child.on('exit', (code, signal) => {
    console.log(`[supervisor] server exited (code=${code}, signal=${signal})`);
    clearInterval(sampleTimer);
    // Small delay avoids a tight crash-restart loop if the server keeps failing immediately.
    setTimeout(startChild, 500);
  });

  sampleTimer = setInterval(checkCpu, SAMPLE_INTERVAL_MS);
}

async function checkCpu() {
  if (!child || !child.pid) return;

  try {
    const stats = await pidusage(child.pid);
    // pidusage reports `cpu` as a percentage of ONE core (matches top/htop).
    const cpuPercent = stats.cpu;

    if (cpuPercent >= THRESHOLD) {
      overThresholdStreak += 1;
      console.log(
        `[supervisor] CPU ${cpuPercent.toFixed(1)}% >= ${THRESHOLD}% ` +
        `(streak ${overThresholdStreak}/${SUSTAINED_SAMPLES})`
      );
    } else {
      overThresholdStreak = 0;
    }

    if (overThresholdStreak >= SUSTAINED_SAMPLES) {
      console.log(`[supervisor] sustained high CPU - restarting server (pid=${child.pid})`);
      overThresholdStreak = 0;
      child.kill('SIGTERM');
      // The 'exit' handler above starts a fresh child automatically.
    }
  } catch (err) {
    // The process may have exited between the tick firing and pidusage's read.
    console.error('[supervisor] pidusage error:', err.message);
  }
}

startChild();

process.on('SIGINT', () => {
  console.log('[supervisor] shutting down');
  clearInterval(sampleTimer);
  if (child) child.kill('SIGTERM');
  process.exit(0);
});
