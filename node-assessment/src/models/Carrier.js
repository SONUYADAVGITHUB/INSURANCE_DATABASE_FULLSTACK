const mongoose = require('mongoose');

// Policy Carrier - company_name only, as specified.
const carrierSchema = new mongoose.Schema(
  {
    company_name: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Carrier', carrierSchema);
