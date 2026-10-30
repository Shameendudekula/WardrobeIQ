// MongoDB connection management with a diagnosable status.
// The status exposes only a reason code — never the connection string or error text.
import mongoose from "mongoose";

const STATES = ["disconnected", "connected", "connecting", "disconnecting"];
const RETRY_AFTER_MS = 15000;

let uri = null;
let lastError = null;
let lastAttempt = 0;
let pending = null;

function classify(err) {
  const msg = String(err?.message || "");
  if (/bad auth|authentication failed/i.test(msg)) return "AUTH_FAILED";
  if (/ENOTFOUND|querySrv|EAI_AGAIN|getaddrinfo/i.test(msg)) return "DNS_LOOKUP_FAILED";
  if (/Invalid scheme|Invalid connection string|URI must|malformed/i.test(msg)) return "INVALID_URI";
  if (/whitelist|ECONNREFUSED|ETIMEDOUT|timed out|Server selection|ECONNRESET/i.test(msg)) return "NETWORK_OR_IP_BLOCKED";
  return "CONNECT_FAILED";
}

function attempt() {
  lastAttempt = Date.now();
  pending = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(() => {
      lastError = null;
      console.log("✅ MongoDB connected");
    })
    .catch((err) => {
      lastError = classify(err);
      console.error(`❌ MongoDB connection error (${lastError}):`, err.message);
    })
    .finally(() => { pending = null; });
  return pending;
}

/** Start connecting (called once at startup). */
export function connectDb(connectionString) {
  uri = connectionString;
  if (!uri) {
    lastError = "MONGO_URI_MISSING";
    console.error("❌ MONGO_URI is not set");
    return Promise.resolve();
  }
  return attempt();
}

/** Resolve true once connected; retries a failed connection at most every 15s. */
export async function ensureDb() {
  if (mongoose.connection.readyState === 1) return true;
  if (pending) await pending;
  else if (uri && mongoose.connection.readyState === 0 && Date.now() - lastAttempt > RETRY_AFTER_MS) await attempt();
  return mongoose.connection.readyState === 1;
}

export function dbStatus() {
  const state = STATES[mongoose.connection.readyState] || "unknown";
  return { db: state, ...(state !== "connected" && lastError && { dbError: lastError }) };
}
