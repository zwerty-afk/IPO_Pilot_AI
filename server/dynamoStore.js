/**
 * DynamoDB-backed persistence for the app store.
 *
 * db.js exposes a synchronous getDb()/saveDb() pair that ~40 call sites in server.js
 * rely on, but the AWS SDK is async. To keep real cloud storage without rewriting every
 * route, this module:
 *
 *   1. loads the whole store from DynamoDB once, at boot (await initStore())
 *   2. serves synchronous reads from that in-memory copy
 *   3. write-throughs on save: updates memory immediately, then persists to DynamoDB
 *      in the background (coalescing rapid writes so a burst becomes one PutItem)
 *
 * Each top-level collection ("users", "documents", ...) is one DynamoDB item keyed by
 * pk, which keeps individual items well under the 400 KB item limit.
 */
import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE = process.env.DYNAMO_TABLE || 'ipo_pilot_data';

export const dynamoEnabled = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  !String(process.env.AWS_ACCESS_KEY_ID).includes('your_') &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.USE_DYNAMO !== 'false'
);

let doc = null;
if (dynamoEnabled) {
  doc = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

// The authoritative in-memory copy. Populated by initStore().
let store = null;
let ready = false;

// Serialized snapshot of what DynamoDB currently holds, per collection.
// Callers mutate the live store object in place (getDb() hands out the real
// reference), so we cannot detect changes by diffing the store against itself —
// it is always equal to itself. This shadow copy is the only reliable baseline.
let persisted = {};

function snapshot(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => { out[k] = JSON.stringify(obj[k]); });
  return out;
}

/** Reads every collection item and reassembles the store object. */
async function loadAll() {
  const out = {};
  let ExclusiveStartKey;
  do {
    const res = await doc.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey }));
    (res.Items || []).forEach((item) => {
      const { pk, value } = item;
      if (pk) out[pk] = value;
    });
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function putCollection(key, value) {
  await doc.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: key, value, updated_at: new Date().toISOString() }
  }));
}

/**
 * Loads the store from DynamoDB, seeding it on first run.
 * Returns the in-memory store, or null when DynamoDB is disabled.
 */
export async function initStore(seed) {
  if (!dynamoEnabled) return null;

  const loaded = await loadAll();
  const isEmpty = Object.keys(loaded).length === 0;

  if (isEmpty) {
    // First boot against a fresh table: write the seed up so the app has data.
    console.log('[dynamo] table empty — seeding initial data');
    const fresh = JSON.parse(JSON.stringify(seed));
    await Promise.all(
      Object.keys(fresh).map((key) => putCollection(key, fresh[key]))
    );
    store = fresh;
  } else {
    // Backfill any collection added since the table was first written.
    const merged = { ...loaded };
    const missing = Object.keys(seed).filter((k) => !(k in merged));
    if (missing.length) {
      console.log('[dynamo] backfilling new collections:', missing.join(', '));
      missing.forEach((k) => { merged[k] = JSON.parse(JSON.stringify(seed[k])); });
      await Promise.all(missing.map((k) => putCollection(k, merged[k])));
    }
    store = merged;
  }

  // Baseline for change detection: everything in `store` is now in DynamoDB.
  persisted = snapshot(store);

  ready = true;
  console.log(`[dynamo] store ready (table=${TABLE}, collections=${Object.keys(store).length})`);
  return store;
}

export function isReady() {
  return ready && store !== null;
}

/** Synchronous read of the in-memory store. */
export function readStore() {
  return store;
}

// ── Write-through with coalescing ──────────────────────────────────────────
// A single request often mutates one collection several times. Rather than one
// PutItem per mutation, mark collections dirty and flush them on the next tick.
//
// Serverless caveat: on Vercel the container may be frozen the instant a response
// is sent, so a timer-deferred flush would never run and the write would be lost
// with no error anywhere. There we skip coalescing and issue the PutItem straight
// away, keeping a promise the request can await before responding.
const SERVERLESS = Boolean(process.env.VERCEL);
const dirty = new Set();
let flushTimer = null;
let inFlight = Promise.resolve();

function scheduleFlush() {
  if (SERVERLESS) {
    const keys = [...dirty];
    dirty.clear();
    if (!keys.length) return;
    inFlight = inFlight
      .then(() => Promise.all(keys.map((k) => putCollection(k, store[k]))))
      .catch((err) => console.error('[dynamo] write failed:', err.name, err.message));
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const keys = [...dirty];
    dirty.clear();
    if (!keys.length) return;
    inFlight = inFlight
      .then(() => Promise.all(keys.map((k) => putCollection(k, store[k]))))
      .catch((err) => console.error('[dynamo] write failed:', err.name, err.message));
  }, 50);
}

/**
 * Replaces the in-memory store and persists whichever collections changed.
 * Mirrors the old saveDb(data) signature so call sites stay untouched.
 */
export function writeStore(next) {
  if (!store) { store = next; }
  store = next;

  // Compare against the last-persisted snapshot rather than the live store.
  Object.keys(store).forEach((key) => {
    const serialized = JSON.stringify(store[key]);
    if (persisted[key] !== serialized) {
      dirty.add(key);
      persisted[key] = serialized;
    }
  });

  scheduleFlush();
}

/** Awaits any pending writes — useful in tests and on shutdown. */
export async function flushStore() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  const keys = [...dirty];
  dirty.clear();
  if (keys.length) {
    inFlight = inFlight.then(() => Promise.all(keys.map((k) => putCollection(k, store[k]))));
  }
  await inFlight;
}

export { TABLE, REGION };
