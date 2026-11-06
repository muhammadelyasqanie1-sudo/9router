"use client";

import { useCallback, useEffect, useState } from "react";

const PERMISSIONS = [
  ["dashboard:access", "Dashboard access"],
  ["providers:read", "View providers"],
  ["providers:manage", "Manage providers"],
  ["routing:read", "View routing and keys"],
  ["routing:manage", "Manage routing and keys"],
  ["usage:read", "View usage"],
  ["usage:manage", "Reset provider usage and credits"],
  ["settings:read", "View settings"],
  ["settings:manage", "Change settings"],
  ["integrations:read", "View integrations"],
  ["integrations:manage", "Manage integrations"],
  ["system:read", "View system tools"],
  ["system:manage", "Manage system tools"],
  ["audit:read", "View audit log"],
];

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function PermissionChecks({ values, onChange, compact = false }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${compact ? "mt-3" : ""}`}>
      {PERMISSIONS.map(([value, label]) => (
        <label key={value} className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={values.includes(value)}
            onChange={(event) => onChange(
              event.target.checked ? [...new Set([...values, value])] : values.filter((item) => item !== value)
            )}
            className="accent-primary"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function ControlPlaneUsersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [actor, setActor] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [form, setForm] = useState({
    email: "", displayName: "", password: "", role: "staff",
    permissions: ["dashboard:access", "providers:read", "usage:read"],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await readJson(await fetch("/api/auth/status", { cache: "no-store" }));
      if (!status.controlPlaneMode) {
        setActor({ unavailable: true, message: "AFG AI control-plane mode is not enabled on this instance." });
        setUsers([]);
        setEvents([]);
        return;
      }
      if (status.controlPlaneRole !== "superadmin") {
        setActor({ forbidden: true, message: "Only the owner superadministrator can manage staff accounts." });
        setUsers([]);
        setEvents([]);
        return;
      }
      setActor({ role: status.controlPlaneRole, email: status.controlPlaneEmail, displayName: status.displayName });
      const [userData, auditData] = await Promise.all([
        readJson(await fetch("/api/admin/users", { cache: "no-store" })),
        readJson(await fetch("/api/admin/audit?limit=150", { cache: "no-store" })),
      ]);
      setUsers(userData.users || []);
      setEvents(auditData.events || []);
    } catch (err) {
      setError(err.message || "Unable to load management data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const draftFor = (user) => drafts[user.id] || {
    role: user.role,
    permissions: user.permissions || [],
  };
  const updateDraft = (user, patch) => setDrafts((current) => ({
    ...current,
    [user.id]: { ...draftFor(user), ...patch },
  }));

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await readJson(response);
      setForm({
        email: "", displayName: "", password: "", role: "staff",
        permissions: ["dashboard:access", "providers:read", "usage:read"],
      });
      setNotice("Account created. The staff member can now sign in with their email and password.");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create account");
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async (user) => {
    const draft = draftFor(user);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readJson(await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: draft.role, permissions: draft.permissions }),
      }));
      setNotice(`Access updated for ${user.email}. Existing sessions have been revoked.`);
      setDrafts((current) => { const next = { ...current }; delete next[user.id]; return next; });
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update account");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (user) => {
    const action = user.isActive ? "disable" : "enable";
    if (user.isActive && !window.confirm(`Disable ${user.email}? Their active sessions will stop working immediately.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readJson(await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      }));
      setNotice(`Account ${action}d. Existing sessions have been revoked.`);
      await loadData();
    } catch (err) {
      setError(err.message || `Unable to ${action} account`);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (user) => {
    const password = passwordDrafts[user.id] || "";
    if (password.length < 12) {
      setError("A new password must be at least 12 characters.");
      return;
    }
    if (!window.confirm(`Reset the password for ${user.email}? Their current sessions will be revoked.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await readJson(await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      setPasswordDrafts((current) => ({ ...current, [user.id]: "" }));
      setNotice(`Password reset for ${user.email}. Existing sessions have been revoked.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to reset password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto py-10 text-sm text-text-muted">Loading control-plane management…</div>;
  }

  if (actor?.unavailable || actor?.forbidden) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-2xl text-amber-500">admin_panel_settings</span>
          <h2 className="text-lg font-semibold text-text-main">Management access unavailable</h2>
        </div>
        <p className="text-sm text-text-muted">{actor.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">admin_panel_settings</span>
            <h2 className="text-2xl font-semibold text-text-main">AFG AI Control Plane</h2>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Manage administrator accounts, staff scopes, and privileged activity in 9Router.
          </p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
          Signed in as <span className="font-semibold text-text-main">{actor?.displayName || actor?.email || "Owner"}</span>
          <span className="mx-2 text-border">·</span>
          <span className="text-primary font-semibold">Superadmin</span>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</div>}

      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setActiveTab("users")} className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-text-muted"}`}>
          Staff accounts ({users.length})
        </button>
        <button onClick={() => setActiveTab("audit")} className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === "audit" ? "border-primary text-primary" : "border-transparent text-text-muted"}`}>
          Audit activity ({events.length})
        </button>
        <button onClick={loadData} className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-text-muted hover:bg-surface-2">
          <span className="material-symbols-outlined text-base">refresh</span> Refresh
        </button>
      </div>

      {activeTab === "users" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)] gap-5 items-start">
          <section className="space-y-3">
            {users.length === 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 text-sm text-text-muted">No staff accounts have been created yet.</div>
            )}
            {users.map((user) => {
              const draft = draftFor(user);
              return (
                <article key={user.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-text-main truncate">{user.displayName}</div>
                      <div className="text-xs text-text-muted break-all">{user.email}</div>
                      <div className="text-[11px] text-text-muted mt-1">
                        Created {new Date(user.createdAt).toLocaleString()}
                        {user.lastLoginAt ? ` · Last login ${new Date(user.lastLoginAt).toLocaleString()}` : " · Never signed in"}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${user.isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                      {user.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-text-muted flex items-center gap-2">
                      Role
                      <select value={draft.role} onChange={(e) => updateDraft(user, { role: e.target.value })} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main">
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button disabled={saving} onClick={() => saveUser(user)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save role & permissions</button>
                    <button disabled={saving} onClick={() => toggleUser(user)} className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:bg-surface-2 disabled:opacity-50">
                      {user.isActive ? "Disable account" : "Enable account"}
                    </button>
                  </div>

                  <details className="rounded-xl border border-border-subtle bg-bg/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-text-main">Permission scopes ({draft.permissions.length})</summary>
                    <PermissionChecks values={draft.permissions} onChange={(values) => updateDraft(user, { permissions: values })} compact />
                  </details>

                  <details className="rounded-xl border border-border-subtle bg-bg/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-text-main">Reset staff password</summary>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <input
                        type="password"
                        minLength={12}
                        placeholder="New password (12+ characters)"
                        value={passwordDrafts[user.id] || ""}
                        onChange={(e) => setPasswordDrafts((current) => ({ ...current, [user.id]: e.target.value }))}
                        className="flex-1 min-w-[200px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main"
                      />
                      <button disabled={saving} onClick={() => resetPassword(user)} className="rounded-lg border border-border px-3 py-2 text-xs text-text-main hover:bg-surface-2 disabled:opacity-50">Reset password</button>
                    </div>
                  </details>
                </article>
              );
            })}
          </section>

          <aside className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">person_add</span>
              <h3 className="font-semibold text-text-main">Create staff account</h3>
            </div>
            <form onSubmit={createUser} className="space-y-3">
              <label className="block text-xs text-text-muted">
                Full name
                <input required maxLength={80} value={form.displayName} onChange={(e) => updateForm("displayName", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main" />
              </label>
              <label className="block text-xs text-text-muted">
                Email
                <input required type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main" />
              </label>
              <label className="block text-xs text-text-muted">
                Temporary password
                <input required type="password" minLength={12} value={form.password} onChange={(e) => updateForm("password", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main" />
                <span className="block mt-1 text-[11px]">At least 12 characters. Share it securely; it is never shown again.</span>
              </label>
              <label className="block text-xs text-text-muted">
                Role
                <select value={form.role} onChange={(e) => updateForm("role", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-main">
                  <option value="staff">Staff — selected scopes only</option>
                  <option value="admin">Admin — operational management</option>
                </select>
              </label>
              <div className="rounded-xl border border-border-subtle p-3">
                <div className="text-xs font-semibold text-text-main mb-2">Allowed scopes</div>
                <PermissionChecks values={form.permissions} onChange={(values) => updateForm("permissions", values)} />
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Create account"}
              </button>
            </form>
          </aside>
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-surface overflow-hidden">
          {events.length === 0 ? (
            <div className="p-5 text-sm text-text-muted">No control-plane audit events recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-bg/70 text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Actor</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Client IP</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-border-subtle text-text-main">
                      <td className="px-4 py-3 whitespace-nowrap text-text-muted">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{event.actorEmail || event.actorId || "System"}</td>
                      <td className="px-4 py-3 font-medium">{event.action}</td>
                      <td className="px-4 py-3">{event.targetType || "—"} {event.targetId || ""}</td>
                      <td className="px-4 py-3 text-text-muted">{event.clientIp || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
