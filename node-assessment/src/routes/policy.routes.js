const express = require('express');
const { searchPolicies, aggregateByUser, aggregateAllUsers } = require('../controllers/policy.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/policies/search?firstname=Alex&email=optional@x.com
router.get('/search', asyncHandler(searchPolicies));

// GET /api/policies/aggregate  -> rollup for every user
router.get('/aggregate', asyncHandler(aggregateAllUsers));

// GET /api/policies/aggregate/:userId  -> rollup for one user
router.get('/aggregate/:userId', asyncHandler(aggregateByUser));

module.exports = router;
