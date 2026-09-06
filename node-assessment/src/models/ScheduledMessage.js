const mongoose = require('mongoose');

// Task 2.2 - a message scheduled to be inserted at a given day/time.
// `scheduledFor` is always stored as UTC (see README for the timezone
// assumption). `status` lets the server re-hydrate any jobs that were
// still pending if it restarts before their time arrives - a lightweight
// step toward persistence without a full queue library.
const scheduledMessageSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    day: { type: String, required: true },   // raw input, e.g. "2026-09-10"
    time: { type: String, required: true },   // raw input, e.g. "14:30"
    scheduledFor: { type: Date, required: true }, // resolved UTC timestamp
    status: {
      type: String,
      enum: ['pending', 'inserted', 'failed'],
      default: 'pending'
    },
    insertedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
