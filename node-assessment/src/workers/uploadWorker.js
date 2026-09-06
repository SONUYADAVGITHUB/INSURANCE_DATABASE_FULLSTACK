/**
 * Runs inside a worker_thread (spawned by upload.controller.js) so that
 * parsing a large spreadsheet and doing the dedupe/insert work never
 * blocks the main event loop / HTTP server.
 *
 * A worker thread can't share the main thread's mongoose connection, so
 * it opens its own connection to MongoDB using the URI passed in via
 * workerData.
 *
 * Assumption: one worker handles the whole file (no chunking/parallel
 * workers) - confirmed as sufficient for this assessment.
 */
const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');

const Agent = require('../models/Agent');
const User = require('../models/User');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

const { parseFile } = require('../utils/parseFile');

const BATCH_SIZE = 500;

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toDate(value) {
  const v = clean(value);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toNumber(value) {
  const v = clean(value);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Finds-or-creates a reference document, caching the result in memory so
 * repeated names in the spreadsheet only hit the DB once each, and reuse
 * the same ObjectId instead of creating a document per row.
 */
async function upsertRef(Model, filter, setOnInsert, cache, cacheKey) {
  if (!cacheKey) return undefined;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const doc = await Model.findOneAndUpdate(
    filter,
    { $setOnInsert: setOnInsert },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  cache.set(cacheKey, doc._id);
  return doc._id;
}

async function run() {
  const { filePath, mongoUri } = workerData;

  await mongoose.connect(mongoUri, { maxPoolSize: 5 });

  const rows = parseFile(filePath);
  const total = rows.length;

  const agentCache = new Map();
  const categoryCache = new Map();
  const carrierCache = new Map();
  const accountCache = new Map();
  const userCache = new Map();

  let buffer = [];
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const policyNumber = clean(row.policy_number);
      const categoryName = clean(row.category_name);
      const companyName = clean(row.company_name);
      const email = clean(row.email).toLowerCase();
      const firstname = clean(row.firstname);

      // Required refs - skip the row if we can't build a valid policy from it.
      if (!policyNumber || !categoryName || !companyName || !firstname) {
        skipped += 1;
        continue;
      }

      const categoryId = await upsertRef(
        Category,
        { category_name: categoryName },
        { category_name: categoryName },
        categoryCache,
        categoryName.toLowerCase()
      );

      const carrierId = await upsertRef(
        Carrier,
        { company_name: companyName },
        { company_name: companyName },
        carrierCache,
        companyName.toLowerCase()
      );

      const agentName = clean(row.agent);
      const agentId = agentName
        ? await upsertRef(
            Agent,
            { name: agentName },
            { name: agentName },
            agentCache,
            agentName.toLowerCase()
          )
        : undefined;

      const accountName = clean(row.account_name);
      const accountId = accountName
        ? await upsertRef(
            Account,
            { account_name: accountName },
            { account_name: accountName, account_type: clean(row.account_type) },
            accountCache,
            accountName.toLowerCase()
          )
        : undefined;

      // User dedupe key: email when present (matches the DB's unique
      // index). When email is blank, fall back to a composite key so
      // rows for the same person still reuse one document; this
      // fallback isn't DB-enforced, only de-duped within this run
      // (documented assumption - see README).
      const userKey = email || `${firstname.toLowerCase()}|${clean(row.dob)}|${clean(row.phone)}`;
      // Build the filter without undefined-valued keys - the MongoDB
      // driver serializes `undefined` as BSON null by default, which
      // would otherwise turn this into "dob IS null" instead of
      // "dob field omitted from the match".
      const userFilter = email
        ? { email }
        : Object.fromEntries(
            Object.entries({ firstname, dob: toDate(row.dob), phone: clean(row.phone) || undefined }).filter(
              ([, v]) => v !== undefined
            )
          );

      // Same undefined-stripping concern as the filter above: an explicit
      // `email: undefined` (or dob) would otherwise be sent to MongoDB as
      // `null`, which defeats the sparse unique index on email once more
      // than one user has no email.
      const userSetOnInsert = Object.fromEntries(
        Object.entries({
          firstname,
          dob: toDate(row.dob),
          address: clean(row.address),
          city: clean(row.city),
          phone: clean(row.phone),
          state: clean(row.state),
          zip: clean(row.zip),
          email: email || undefined,
          gender: clean(row.gender),
          userType: clean(row.userType)
        }).filter(([, v]) => v !== undefined)
      );

      const userId = await upsertRef(User, userFilter, userSetOnInsert, userCache, userKey);

      buffer.push({
        policy_number: policyNumber,
        policy_start_date: toDate(row.policy_start_date),
        policy_end_date: toDate(row.policy_end_date),
        user_id: userId,
        category_id: categoryId,
        company_id: carrierId,
        agent_id: agentId,
        account_id: accountId,
        premium_amount_written: toNumber(row.premium_amount_written),
        premium_amount: toNumber(row.premium_amount),
        policy_type: clean(row.policy_type),
        policy_mode: clean(row.policy_mode),
        producer: clean(row.producer),
        csr: clean(row.csr),
        primary: clean(row.primary),
        applicant_id: clean(row['Applicant ID']),
        agency_id: clean(row.agency_id),
        has_active_client_policy: clean(row['hasActive ClientPolicy'])
      });

      if (buffer.length >= BATCH_SIZE) {
        await Policy.insertMany(buffer, { ordered: false });
        inserted += buffer.length;
        buffer = [];
        parentPort.postMessage({ type: 'progress', processed: i + 1, total });
      }
    } catch (rowErr) {
      skipped += 1;
    }
  }

  if (buffer.length) {
    await Policy.insertMany(buffer, { ordered: false });
    inserted += buffer.length;
  }

  await mongoose.disconnect();

  parentPort.postMessage({
    type: 'done',
    summary: {
      totalRows: total,
      policiesInserted: inserted,
      rowsSkipped: skipped,
      agents: agentCache.size,
      users: userCache.size,
      accounts: accountCache.size,
      categories: categoryCache.size,
      carriers: carrierCache.size
    }
  });
}

run().catch((err) => {
  parentPort.postMessage({ type: 'error', message: err.message });
  process.exit(1);
});
