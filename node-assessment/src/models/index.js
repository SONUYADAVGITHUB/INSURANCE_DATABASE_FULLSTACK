/**
 * Every model must be `require`'d somewhere in the process before
 * `.populate()` can resolve its `ref`. policy.controller.js only
 * directly requires Policy and User, so populating category_id,
 * company_id, agent_id, and account_id was throwing:
 *   MissingSchemaError: Schema hasn't been registered for model "Category"
 * (and the same for "Carrier", and would have for "Agent"/"Account" as
 * soon as those refs were populated too - see README).
 *
 * Requiring this file once at startup registers all six models with
 * Mongoose regardless of which controller happens to reference them
 * directly, so populate() always has what it needs.
 */
require('./Agent');
require('./User');
require('./Account');
require('./Category');
require('./Carrier');
require('./Policy');
require('./ScheduledMessage');
