const mongoose = require('mongoose');

// User - required fields from the brief: firstname, dob, address, phone,
// state, zip, email, gender, userType.
//
// `city` is kept here too (closest relevant model - it's part of the
// user's address, not the policy or the account).
//
// Dedup key: `email`. The sample data has one email per person, so it's
// the most reliable natural key for reusing a User document across every
// policy row that belongs to the same person. Index is sparse+unique so
// rows with a blank email don't collide with each other.
const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true, trim: true },
    dob: { type: Date },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    phone: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    gender: { type: String, trim: true },
    userType: { type: String, trim: true }
  },
  { timestamps: true }
);

// Case-insensitive search by firstname (Task 1.2) - see policy.controller.js
userSchema.index({ firstname: 1 });

module.exports = mongoose.model('User', userSchema);
