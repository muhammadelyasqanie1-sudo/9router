"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function AfgAiAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afg-ai/announcements", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load announcements.");
      setItems(Array.isArray(data.announcements) ? data.announcements : []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Unable to load announcements.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (!window.confirm("Publish this announcement to AFG AI users?")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/afg-ai/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Announcement could not be created.");
      setTitle("");
      setBody("");
      setNotice("Announcement created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Announcement could not be created.");
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AFG AI · Communications</div>
            <h1 className="mt-2 text-2xl font-semibold text-text-main">Announcements</h1>
            <p className="mt-2 text-sm text-text-muted">Create announcements shown to AFG AI users. Existing announcements remain stored in AFG AI.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/afg-ai" className="text-xs text-text-muted hover:text-text-main">Platform overview</Link>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">{notice}</div> : null}

      <form onSubmit={create} className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-text-main">Create announcement</h2>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Announcement title" className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm text-text-main" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required rows={4} placeholder="Write the announcement for AFG AI users…" className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm text-text-main" />
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !title.trim() || !body.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Publishing…" : "Publish announcement"}</button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-main">Recent announcements</h2>
        {loading && items.length === 0 ? <div className="p-5 text-sm text-text-muted">Loading announcements…</div> : null}
        {!loading && items.length === 0 && !error ? <div className="rounded-xl border border-border bg-surface p-5 text-sm text-text-muted">No announcements found.</div> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-main">{item.title}</h3>
              <span className="text-xs text-text-muted">{item.enabled ? "Enabled" : "Disabled"} · {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
