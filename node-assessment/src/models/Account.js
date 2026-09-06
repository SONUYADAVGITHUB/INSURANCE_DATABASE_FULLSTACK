const mongoose = require('mongoose');

// User's Account - required field is account_name. account_type is kept
// here too (closest relevant model: it describes the account, e.g.
// "Commercial" / "Personal", not the policy or the user).
const accountSchema = new mongoose.Schema(
  {
    account_name: { type: String, required: true, unique: true, trim: true },
    account_type: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
