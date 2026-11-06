"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function fmt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AfgAiUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afg-ai/users", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load AFG AI users.");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "Unable to load AFG AI users.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (user) => {
    const next = user.status === "active" ? "suspended" : "active";
    if (next === "suspended" && !window.confirm("Suspend this AFG AI account and revoke its active sessions?")) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/afg-ai/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, status: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The account status could not be changed.");
      setNotice(next === "suspended" ? "Account suspended and active sessions revoked." : "Account reactivated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The account status could not be changed.");
    } finally { setBusyId(""); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AFG AI · Accounts</div>
            <h1 className="mt-2 text-2xl font-semibold text-text-main">User management</h1>
            <p className="mt-2 text-sm text-text-muted">Review AFG AI accounts and suspend or reactivate access. Role changes and account deletion are deliberately not exposed here.</p>
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
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-main">AFG AI accounts</h2>
          <span className="text-xs text-text-muted">{users.length} records · maximum 250</span>
        </div>
        {loading && users.length === 0 ? <div className="p-6 text-sm text-text-muted">Loading accounts…</div> : null}
        {!loading && users.length === 0 && !error ? <div className="p-6 text-sm text-text-muted">No user records were returned.</div> : null}
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-bg text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium">Requests · 30d</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-main">{user.display_name || "AFG AI user"}</div>
                      <div className="mt-1 text-text-muted">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-text-main">{user.role}</td>
                    <td className="px-4 py-3">
                      <span className={user.status === "active" ? "rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600" : "rounded-full bg-amber-500/10 px-2 py-1 text-amber-700"}>{user.status}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{fmt(user.last_seen_at)}</td>
                    <td className="px-4 py-3 tabular-nums text-text-main">{Number(user.requests_30d || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void changeStatus(user)}
                        disabled={busyId === user.id || user.status === "deleted"}
                        className="rounded-lg border border-border px-3 py-2 font-medium text-text-main hover:border-primary/50 disabled:opacity-50"
                      >
                        {busyId === user.id ? "Saving…" : user.status === "active" ? "Suspend" : "Reactivate"}
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
