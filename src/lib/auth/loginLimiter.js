// Persistent progressive lockout for dashboard login.
// Only a one-way SHA-256 digest of the client-IP bucket is stored; raw IPs are
// never written to this table. SQLite UPSERT keeps increments atomic.
import { createHash } from "node:crypto";
import { getAdapter } from "@/lib/db/driver";
import { hasTrustedPeerHeaders } from "./trustedPeer.js";

const MAX_FAILS_BEFORE_LOCK = 5;
const LOCK_STEPS_MS = [30_000, 120_000, 600_000, 1_800_000]; // 30s, 2m, 10m, 30m
const FAIL_WINDOW_MS = 60 * 60 * 1000; // 1h since last fail → auto reset

function now() { return Date.now(); }

function hashBucket(ip) {
  return createHash("sha256").update("9router-login-ip-v1:").update(String(ip || "unknown")).digest("hex");
}

export async function checkLock(ip) {
  const db = await getAdapter();
  const row = db.get("SELECT lockUntil FROM loginRateLimits WHERE bucketHash = ?", [hashBucket(ip)]);
  if (!row || Number(row.lockUntil) <= now()) return { locked: false };
  const retryAfter = Math.ceil((Number(row.lockUntil) - now()) / 1000);
  return { locked: true, retryAfter };
}

export async function recordFail(ip) {
  const db = await getAdapter();
  const timestamp = now();
  const expiredBeforeAttempt = timestamp - FAIL_WINDOW_MS;
  const bucket = hashBucket(ip);

  // Prune expired buckets on failed-login traffic so the table does not grow
  // indefinitely from one-off source IPs. Active locks are never removed.
  db.run(
    "DELETE FROM loginRateLimits WHERE lastFailAt < ? AND lockUntil <= ?",
    [expiredBeforeAttempt, timestamp]
  );

  // One atomic statement handles concurrent requests and progressive lockouts.
  // If the prior failure window expired and its lock is over, start a fresh
  // sequence. Otherwise preserve the accumulated lock level.
  db.run(
    `INSERT INTO loginRateLimits(bucketHash, failures, lockUntil, lockLevel, lastFailAt)
     VALUES(?, 1, 0, 0, ?)
     ON CONFLICT(bucketHash) DO UPDATE SET
       failures = CASE
         WHEN (CASE
           WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 1
           ELSE loginRateLimits.failures + 1
         END) >= ? THEN 0
         WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 1
         ELSE loginRateLimits.failures + 1
       END,
       lockUntil = CASE
         WHEN (CASE
           WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 1
           ELSE loginRateLimits.failures + 1
         END) >= ? THEN ? + CASE loginRateLimits.lockLevel
           WHEN 0 THEN 30000 WHEN 1 THEN 120000 WHEN 2 THEN 600000 ELSE 1800000 END
         WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 0
         ELSE loginRateLimits.lockUntil
       END,
       lockLevel = CASE
         WHEN (CASE
           WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 1
           ELSE loginRateLimits.failures + 1
         END) >= ? THEN MIN(loginRateLimits.lockLevel + 1, 3)
         WHEN loginRateLimits.lastFailAt < ? AND loginRateLimits.lockUntil <= ? THEN 0
         ELSE loginRateLimits.lockLevel
       END,
       lastFailAt = ?`,
    [
      bucket, timestamp,
      expiredBeforeAttempt, timestamp, MAX_FAILS_BEFORE_LOCK, expiredBeforeAttempt, timestamp,
      expiredBeforeAttempt, timestamp, MAX_FAILS_BEFORE_LOCK, timestamp,
      expiredBeforeAttempt, timestamp,
      expiredBeforeAttempt, timestamp, MAX_FAILS_BEFORE_LOCK,
      expiredBeforeAttempt, timestamp,
      timestamp,
    ]
  );

  const row = db.get("SELECT failures, lockUntil FROM loginRateLimits WHERE bucketHash = ?", [bucket]);
  const lockUntil = Number(row?.lockUntil || 0);
  if (lockUntil > timestamp) {
    return { remainingBeforeLock: 0, locked: true, retryAfter: Math.ceil((lockUntil - timestamp) / 1000) };
  }
  return { remainingBeforeLock: Math.max(0, MAX_FAILS_BEFORE_LOCK - Number(row?.failures || 0)), locked: false };
}

export async function recordSuccess(ip) {
  const db = await getAdapter();
  db.run("DELETE FROM loginRateLimits WHERE bucketHash = ?", [hashBucket(ip)]);
}

export function getClientIp(request) {
  // Trusted only when custom-server.js proves it stamped the header from the TCP socket;
  // otherwise a client could rotate the value to escape its own lockout bucket.
  if (hasTrustedPeerHeaders(request)) {
    const realIp = request.headers.get("x-9r-real-ip");
    if (realIp) return realIp;
  }
  // Behind a trusted reverse proxy that overwrites XFF with the real client IP.
  if (process.env.TRUST_PROXY === "true") {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }
  // Direct exposure without custom-server: single bucket so spoofed XFF
  // rotation cannot escape the limiter.
  return "unknown";
}
