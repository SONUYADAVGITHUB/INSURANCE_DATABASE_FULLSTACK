const mongoose = require('mongoose');
const User = require('../models/User');
const Policy = require('../models/Policy');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/policies/search?firstname=Alex&email=optional@x.com
 *
 * Matches on the user's firstname (case-insensitive, exact match).
 * `email` is an additional, optional filter - it narrows the results but
 * is never used on its own in place of firstname.
 */
async function searchPolicies(req, res) {
  const { firstname, email } = req.query;

  if (!firstname || !firstname.trim()) {
    return res.status(400).json({ error: 'Query param "firstname" is required.' });
  }

  const filter = { firstname: new RegExp(`^${escapeRegex(firstname.trim())}$`, 'i') };
  if (email && email.trim()) {
    filter.email = new RegExp(`^${escapeRegex(email.trim())}$`, 'i');
  }

  const users = await User.find(filter).lean();
  if (!users.length) {
    return res.status(404).json({ error: 'No user found matching that firstname.' });
  }

  const userIds = users.map((u) => u._id);
  const policies = await Policy.find({ user_id: { $in: userIds } })
    .populate('category_id', 'category_name')
    .populate('company_id', 'company_name')
    .populate('agent_id', 'name')
    .populate('account_id', 'account_name')
    .lean();

  res.json({ users, policies });
}

/**
 * GET /api/policies/aggregate/:userId
 * Policy count + premium total + policy list for a single user.
 */
async function aggregateByUser(req, res) {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'Invalid userId.' });
  }

  const [result] = await runAggregation({ user_id: new mongoose.Types.ObjectId(userId) });

  if (!result) {
    return res.status(404).json({ error: 'No policies found for that user.' });
  }

  res.json(result);
}

/**
 * GET /api/policies/aggregate
 * Same rollup, but for every user - "aggregated policy by each user".
 */
async function aggregateAllUsers(req, res) {
  const results = await runAggregation({});
  res.json({ users: results });
}

async function runAggregation(matchStage) {
  return Policy.aggregate([
    { $match: matchStage },
    { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: 'category' } },
    { $lookup: { from: 'carriers', localField: 'company_id', foreignField: '_id', as: 'carrier' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$carrier', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$user_id',
        policyCount: { $sum: 1 },
        premiumTotal: { $sum: { $ifNull: ['$premium_amount', 0] } },
        policies: {
          $push: {
            policy_number: '$policy_number',
            policy_start_date: '$policy_start_date',
            policy_end_date: '$policy_end_date',
            premium_amount: '$premium_amount',
            category: '$category.category_name',
            carrier: '$carrier.company_name'
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        firstname: '$user.firstname',
        email: '$user.email',
        policyCount: 1,
        premiumTotal: 1,
        policies: 1
      }
    }
  ]);
}

module.exports = { searchPolicies, aggregateByUser, aggregateAllUsers };
