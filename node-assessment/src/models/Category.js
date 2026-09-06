const mongoose = require('mongoose');

// Policy Category / Line of Business (LOB) - category_name only, as specified.
const categorySchema = new mongoose.Schema(
  {
    category_name: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
