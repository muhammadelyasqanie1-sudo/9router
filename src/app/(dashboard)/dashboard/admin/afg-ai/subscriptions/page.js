"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

export default function AfgAiSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlans, setSelectedPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afg-ai/subscriptions", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load AFG AI subscriptions.");
      setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
      setPlans(Array.isArray(data.plans) ? data.plans : []);
      setSelectedPlans((previous) => {
        const next = { ...previous };
        for (const row of data.subscriptions || []) {
          if (!next[row.user_id]) next[row.user_id] = ["free", "pro"].includes(row.plan_key) ? row.plan_key : "free";
        }
        return next;
      });
    } catch (err) {
      setSubscriptions([]);
      setPlans([]);
      setError(err instanceof Error ? err.message : "Unable to load AFG AI subscriptions.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enabledPlans = useMemo(() => plans.filter((plan) => plan.enabled && ["free", "pro"].includes(plan.plan_key)), [plans]);

  const assign = async (row) => {
    const planKey = selectedPlans[row.user_id] || "free";
    const current = row.plan_key || "none";
    if (planKey === current && row.status === "active") {
      setNotice("This account already has the selected active plan.");
      return;
    }
    if (!window.confirm("Replace the current AFG AI subscription for " + row.email + " with the " + planKey.toUpperCase() + " plan?")) return;
    setBusyId(row.user_id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/afg-ai/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.user_id, planKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The subscription could not be updated.");
      setNotice(data.subscription?.unchanged ? "No subscription change was needed." : "The " + planKey.toUpperCase() + " plan was assigned successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The subscription could not be updated.");
    } finally { setBusyId(""); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AFG AI · Billing operations</div>
            <h1 className="mt-2 text-2xl font-semibold text-text-main">Subscription management</h1>
            <p className="mt-2 text-sm text-text-muted">Assign the existing Free or Pro plan to active accounts. This does not charge a payment method or create a payment transaction.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/afg-ai" className="text-xs text-text-muted hover:text-text-main">Platform overview</Link>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {enabledPlans.map((plan) => (
          <div key={plan.plan_key} className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-wider text-text-muted">{plan.plan_key} plan</div>
            <div className="mt-2 text-xl font-semibold text-text-main">{money(plan.monthly_price_usd)}<span className="ml-1 text-xs font-normal text-text-muted">/ month</span></div>
            <div className="mt-1 text-xs text-text-muted">{plan.display_name}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-main">Active AFG AI accounts</h2>
          <span className="text-xs text-text-muted">{subscriptions.length} records · maximum 300</span>
        </div>
        {loading && subscriptions.length === 0 ? <div className="p-6 text-sm text-text-muted">Loading subscriptions…</div> : null}
        {!loading && subscriptions.length === 0 && !error ? <div className="p-6 text-sm text-text-muted">No active accounts were returned.</div> : null}
        {subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-bg text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Current plan</th>
                  <th className="px-4 py-3 font-medium">Subscription status</th>
                  <th className="px-4 py-3 font-medium">Plan dates</th>
                  <th className="px-4 py-3 font-medium">Assign plan</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr key={row.user_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-main">{row.email}</div>
                      <div className="mt-1 text-text-muted">{row.user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-text-main">{row.plan_name || "No plan"}</td>
                    <td className="px-4 py-3 text-text-muted">{row.status || "not assigned"}</td>
                    <td className="px-4 py-3 text-text-muted">{row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "—"}{row.ends_at ? " – " + new Date(row.ends_at).toLocaleDateString() : ""}</td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedPlans[row.user_id] || (["free", "pro"].includes(row.plan_key) ? row.plan_key : "free")}
                        onChange={(event) => setSelectedPlans((previous) => ({ ...previous, [row.user_id]: event.target.value }))}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text-main"
                      >
                        {enabledPlans.map((plan) => <option key={plan.plan_key} value={plan.plan_key}>{plan.display_name || plan.plan_key}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => void assign(row)} disabled={busyId === row.user_id || enabledPlans.length === 0} className="rounded-lg bg-primary px-3 py-2 font-medium text-white disabled:opacity-50">
                        {busyId === row.user_id ? "Saving…" : "Assign"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
