"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function number(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}
function money(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value || 0));
}
function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-text-main">{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </div>
  );
}

export default function AfgAiPlatformPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afg-ai/overview", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.available !== true) throw new Error(result.error || "AFG AI management data is unavailable.");
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "AFG AI management data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const today = data?.today || {};
  const requests = data?.requests24h || {};
  const errorRate = Number(today.requests || 0) ? (Number(today.errors || 0) / Number(today.requests)) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-2xl">monitor_heart</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">AFG AI · Platform operations</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-text-main sm:text-3xl">AFG AI platform overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">Live aggregate data from the AFG AI backend. This page does not expose user records, provider credentials, or service secrets.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/afg-ai/users" className="text-xs text-text-muted hover:text-text-main">Manage accounts</Link>
            <Link href="/dashboard/admin/afg-ai/subscriptions" className="text-xs text-text-muted hover:text-text-main">Subscriptions</Link>
            <Link href="/dashboard/admin/afg-ai/settings" className="text-xs text-text-muted hover:text-text-main">Feature settings</Link>
            <Link href="/dashboard/admin/afg-ai/announcements" className="text-xs text-text-muted hover:text-text-main">Announcements</Link>
            <Link href="/dashboard/admin" className="text-xs text-text-muted hover:text-text-main">Management center</Link>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <div className="font-semibold">Live AFG AI data is not connected</div>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs">Configure the server-side bridge URL and shared secret on both services. No sample data is shown.</p>
        </div>
      ) : null}

      {loading && !data ? <div className="py-10 text-sm text-text-muted">Loading live AFG AI metrics…</div> : null}

      {data ? (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-text-main">Accounts & usage today</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Total users" value={number(data.users?.total)} hint={number(data.users?.active) + " active · " + number(data.users?.suspended) + " suspended"} />
              <Metric label="AI requests today" value={number(today.requests)} hint={number(today.active_users) + " active requesting users"} />
              <Metric label="Known AI cost today" value={money(today.cost_usd)} hint="Unpriced requests are not included" />
              <Metric label="Error rate today" value={errorRate.toFixed(2) + "%"} hint={number(today.errors) + " failed requests"} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-text-main">Service health</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Providers" value={number(data.providers?.enabled) + " / " + number(data.providers?.total)} hint={number(data.providers?.failing) + " failing enabled providers"} />
              <Metric label="Models" value={number(data.models?.enabled) + " / " + number(data.models?.total)} hint={number(data.models?.needs_verification) + " need verification"} />
              <Metric label="Integrations healthy" value={number(data.integrations?.healthy) + " / " + number(data.integrations?.total)} />
              <Metric label="Feature flags enabled" value={number(data.featureFlags?.enabled) + " / " + number(data.featureFlags?.total)} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-text-main">Performance & traffic</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Average latency (24h)" value={number(data.latency24h?.average_ms) + " ms"} />
              <Metric label="P95 latency (24h)" value={number(data.latency24h?.p95_ms) + " ms"} />
              <Metric label="Requests (24h)" value={number(requests.total)} hint={number(requests.server_errors) + " server errors · " + number(requests.client_errors) + " client errors"} />
              <Metric label="Tokens today" value={number(Number(today.input_tokens || 0) + Number(today.output_tokens || 0))} hint={number(today.input_tokens) + " input · " + number(today.output_tokens) + " output"} />
            </div>
          </section>
          <p className="text-right text-xs text-text-muted">Last updated: {new Date(data.generatedAt).toLocaleString()}</p>
        </>
      ) : null}
    </div>
  );
}
