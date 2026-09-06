const express = require('express');
const { scheduleMessage, listScheduledMessages } = require('../controllers/schedule.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/messages?status=pending  -> list scheduled jobs (newest scheduledFor first)
router.get('/', asyncHandler(listScheduledMessages));

// POST /api/messages/schedule  { message, day: "YYYY-MM-DD", time: "HH:mm" (UTC) }
router.post('/schedule', asyncHandler(scheduleMessage));

module.exports = router;
