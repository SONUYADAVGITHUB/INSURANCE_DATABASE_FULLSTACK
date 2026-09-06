const mongoose = require('mongoose');
const { Schema } = mongoose;

// Policy Info - required fields: policy_number, policy_start_date,
// policy_end_date, plus references to Category (LOB), Carrier (company),
// and User.
//
// Extra source columns kept here, and why:
//  - premium_amount_written, premium_amount, policy_type, policy_mode:
//      premium/policy-specific figures, belong with the policy itself.
//  - producer, csr: the people who handled THIS policy transaction. They
//      are not the same as `agent` (kept on the Agent collection), so we
//      keep them as plain strings on Policy Info rather than inventing a
//      new collection for them.
//  - primary, "Applicant ID", agency_id, "hasActive ClientPolicy": all
//      describe this specific policy/application, so they stay here as
//      passthrough fields rather than being dropped.
//
// agent / account references are included but optional (not required by
// the brief) to improve traceability where the source data allows it.
const policySchema = new Schema(
  {
    policy_number: { type: String, required: true, trim: true },
    policy_start_date: { type: Date },
    policy_end_date: { type: Date },

    // required references
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    company_id: { type: Schema.Types.ObjectId, ref: 'Carrier', required: true },

    // optional references (improve traceability, not mandatory)
    agent_id: { type: Schema.Types.ObjectId, ref: 'Agent' },
    account_id: { type: Schema.Types.ObjectId, ref: 'Account' },

    // premium / policy-specific fields
    premium_amount_written: { type: Number },
    premium_amount: { type: Number },
    policy_type: { type: String, trim: true },
    policy_mode: { type: String, trim: true },

    // policy-transaction staff (distinct from the Agent collection)
    producer: { type: String, trim: true },
    csr: { type: String, trim: true },

    // passthrough / source columns without an obvious dedicated model
    primary: { type: String, trim: true },
    applicant_id: { type: String, trim: true },
    agency_id: { type: String, trim: true },
    has_active_client_policy: { type: String, trim: true }
  },
  { timestamps: true }
);

policySchema.index({ policy_number: 1 });
policySchema.index({ user_id: 1 });

module.exports = mongoose.model('Policy', policySchema);
