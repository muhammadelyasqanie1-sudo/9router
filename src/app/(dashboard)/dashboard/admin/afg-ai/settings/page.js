"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const LOCAL_ONLY_FLAGS = new Set(["terminal_exec_enabled", "offline_sync_enabled"]);

export default function AfgAiFeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afg-ai/feature-flags", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load feature flags.");
      setFlags(Array.isArray(data.flags) ? data.flags : []);
    } catch (err) {
      setFlags([]);
      setError(err instanceof Error ? err.message : "Unable to load feature flags.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (flag) => {
    const enabled = !flag.enabled;
    if (enabled && LOCAL_ONLY_FLAGS.has(flag.flag_key)) return;
    if (!window.confirm((enabled ? "Enable " : "Disable ") + flag.flag_key + " for AFG AI?")) return;
    setBusyKey(flag.flag_key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/afg-ai/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.flag_key, enabled, description: flag.description || "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Feature flag update failed.");
      setNotice(flag.flag_key + " was " + (enabled ? "enabled" : "disabled") + ".");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feature flag update failed.");
    } finally { setBusyKey(""); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AFG AI · Configuration</div>
            <h1 className="mt-2 text-2xl font-semibold text-text-main">Feature flags</h1>
            <p className="mt-2 text-sm text-text-muted">These are live AFG AI backend flags. Some capabilities can only be enabled after their real provider or runtime is verified.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/afg-ai" className="text-xs text-text-muted hover:text-text-main">Platform overview</Link>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">{notice}</div> : null}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-text-main">Live feature flags</div>
        {loading && flags.length === 0 ? <div className="p-5 text-sm text-text-muted">Loading flags…</div> : null}
        {!loading && flags.length === 0 && !error ? <div className="p-5 text-sm text-text-muted">No feature flags were returned.</div> : null}
        <div className="divide-y divide-border">
          {flags.map((flag) => {
            const blocked = LOCAL_ONLY_FLAGS.has(flag.flag_key) && !flag.enabled;
            return (
              <div key={flag.flag_key} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold text-text-main">{flag.flag_key}</div>
                  <p className="mt-1 text-xs text-text-muted">{flag.description || "No description provided."}</p>
                  {blocked ? <p className="mt-1 text-xs text-amber-600">Blocked until an isolated and verified runtime is deployed.</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={flag.enabled ? "text-xs font-semibold text-emerald-600" : "text-xs text-text-muted"}>{flag.enabled ? "Enabled" : "Disabled"}</span>
                  <button
                    onClick={() => void toggle(flag)}
                    disabled={busyKey === flag.flag_key || blocked}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main hover:border-primary/50 disabled:opacity-40"
                  >
                    {busyKey === flag.flag_key ? "Saving…" : flag.enabled ? "Disable" : blocked ? "Unavailable" : "Enable"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
