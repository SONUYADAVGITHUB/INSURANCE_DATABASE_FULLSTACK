const ScheduledMessage = require('../models/ScheduledMessage');
const { scheduleJob } = require('../services/scheduler');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;      // e.g. 2026-09-10
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // e.g. 14:30, 24h clock

/**
 * POST /api/messages/schedule
 * body: { message, day, time }
 *
 * `day` and `time` are interpreted as UTC (documented assumption - see
 * README). The message is written to MongoDB when the scheduled moment
 * arrives, via an in-process timer that's re-created on server restart
 * for any job still pending (see services/scheduler.js).
 */
async function scheduleMessage(req, res) {
  const { message, day, time } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '"message" is required.' });
  }
  if (!DAY_RE.test(day || '')) {
    return res.status(400).json({ error: '"day" must be in YYYY-MM-DD format.' });
  }
  if (!TIME_RE.test(time || '')) {
    return res.status(400).json({ error: '"time" must be in 24-hour HH:mm format.' });
  }

  const scheduledFor = new Date(`${day}T${time}:00.000Z`);
  if (Number.isNaN(scheduledFor.getTime())) {
    return res.status(400).json({ error: 'day/time did not resolve to a valid date.' });
  }
  if (scheduledFor.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Scheduled day/time must be in the future.' });
  }

  const job = await ScheduledMessage.create({
    message: message.trim(),
    day,
    time,
    scheduledFor
  });

  scheduleJob(job);

  res.status(201).json({
    message: 'Message scheduled.',
    job: { id: job._id, scheduledFor: job.scheduledFor, status: job.status }
  });
}

/**
 * GET /api/messages
 * Lists scheduled message jobs, most recently scheduled first. Optional
 * ?status=pending|inserted|failed filter.
 */
async function listScheduledMessages(req, res) {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const jobs = await ScheduledMessage.find(filter).sort({ scheduledFor: -1 }).limit(100).lean();

  res.json({
    jobs: jobs.map((j) => ({
      id: j._id,
      message: j.message,
      day: j.day,
      time: j.time,
      scheduledFor: j.scheduledFor,
      status: j.status,
      insertedAt: j.insertedAt
    }))
  });
}

module.exports = { scheduleMessage, listScheduledMessages };
