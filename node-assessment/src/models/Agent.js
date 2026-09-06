const mongoose = require('mongoose');

// Agent - as specified: just the agent's name.
// `name` is unique so repeated rows for the same agent reuse one document
// instead of creating a duplicate per spreadsheet row.
const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agent', agentSchema);
