const express = require('express');
const upload = require('../config/upload');
const { uploadFile } = require('../controllers/upload.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /api/upload  (multipart/form-data, field name: "file")
router.post('/', upload.single('file'), asyncHandler(uploadFile));

module.exports = router;
