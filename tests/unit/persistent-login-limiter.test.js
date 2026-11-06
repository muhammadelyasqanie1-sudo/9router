import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-login-limit-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
});

afterEach(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  vi.restoreAllMocks();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("persistent dashboard login limiter", () => {
  it("locks after five failures and clears the bucket after a successful login", async () => {
    const { recordFail, checkLock, recordSuccess } = await import("@/lib/auth/loginLimiter.js");

    for (let i = 0; i < 4; i += 1) {
      const result = await recordFail("198.51.100.20");
      expect(result.remainingBeforeLock).toBe(4 - i);
      expect(result.locked).toBe(false);
    }

    const fifth = await recordFail("198.51.100.20");
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfter).toBeGreaterThan(0);
    expect((await checkLock("198.51.100.20")).locked).toBe(true);

    await recordSuccess("198.51.100.20");
    expect((await checkLock("198.51.100.20")).locked).toBe(false);
  });

  it("retains a lockout after the database adapter is reinitialized", async () => {
    const limiter = await import("@/lib/auth/loginLimiter.js");
    for (let i = 0; i < 5; i += 1) await limiter.recordFail("198.51.100.21");
    expect((await limiter.checkLock("198.51.100.21")).locked).toBe(true);

    try { global._dbAdapter?.instance?.close?.(); } catch {}
    delete global._dbAdapter;
    vi.resetModules();

    const restartedLimiter = await import("@/lib/auth/loginLimiter.js");
    expect((await restartedLimiter.checkLock("198.51.100.21")).locked).toBe(true);
  });
});
