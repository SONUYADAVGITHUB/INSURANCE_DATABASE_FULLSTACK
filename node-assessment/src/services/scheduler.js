const ScheduledMessage = require('../models/ScheduledMessage');

// jobId -> Timeout handle, so a job can be found again if ever needed
// (not required by the brief, kept only for clean shutdown/debugging).
const timers = new Map();

/**
 * Schedules a single job's DB write for its target time. If the process
 * restarts, in-memory timers are lost - `rehydratePendingJobs` below
 * re-creates them for anything still pending, using scheduledFor stored
 * in MongoDB.
 */
function scheduleJob(job) {
  const delay = job.scheduledFor.getTime() - Date.now();
  const ms = Math.max(delay, 0);

  const timeout = setTimeout(async () => {
    try {
      const fresh = await ScheduledMessage.findById(job._id);
      if (!fresh || fresh.status !== 'pending') return;

      fresh.status = 'inserted';
      fresh.insertedAt = new Date();
      await fresh.save();

      console.log(`[scheduler] inserted message ${job._id} at ${fresh.insertedAt.toISOString()}`);
    } catch (err) {
      console.error(`[scheduler] failed to finalize job ${job._id}:`, err.message);
    } finally {
      timers.delete(String(job._id));
    }
  }, ms);

  timers.set(String(job._id), timeout);
}

/**
 * Called once on server startup. Re-schedules any job that was still
 * "pending" when the process last stopped. Anything already past its
 * scheduled time fires immediately.
 */
async function rehydratePendingJobs() {
  const pending = await ScheduledMessage.find({ status: 'pending' });
  pending.forEach(scheduleJob);
  if (pending.length) {
    console.log(`[scheduler] rehydrated ${pending.length} pending job(s)`);
  }
}

module.exports = { scheduleJob, rehydratePendingJobs };
