"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const ADMIN_ROLE_PERMISSIONS = new Set([
  "providers:read", "providers:manage",
  "routing:read", "routing:manage",
  "usage:read",
  "settings:read",
  "integrations:read", "integrations:manage",
]);

const MANAGEMENT_AREAS = [
  {
    title: "AFG AI accounts",
    description: "Review AFG AI user accounts and manage suspension or reactivation.",
    href: "/dashboard/admin/afg-ai/users",
    permission: "afg-ai:users:read",
    icon: "manage_accounts",
  },
  {
    title: "AFG AI subscriptions",
    description: "Review active accounts and assign the existing Free or Pro subscription plan.",
    href: "/dashboard/admin/afg-ai/subscriptions",
    permission: "afg-ai:subscriptions:read",
    icon: "card_membership",
  },
  {
    title: "AFG AI platform",
    description: "Monitor AFG AI accounts, usage, costs, provider health, integrations, and feature status.",
    href: "/dashboard/admin/afg-ai",
    permission: "afg-ai:read",
    icon: "monitor_heart",
  },
  {
    title: "Provider connections",
    description: "Manage AI providers, credentials, model connections, and provider health.",
    href: "/dashboard/providers",
    permission: "providers:read",
    icon: "dns",
  },
  {
    title: "Routing & model aliases",
    description: "Manage model combinations, routing strategies, and model aliases.",
    href: "/dashboard/combos",
    permission: "routing:read",
    icon: "alt_route",
  },
  {
    title: "API endpoints & keys",
    description: "Create and manage API keys, access scopes, and client endpoints.",
    href: "/dashboard/endpoint",
    permission: "routing:read",
    icon: "key",
  },
  {
    title: "Usage analytics",
    description: "Inspect request volume, provider consumption, and model usage.",
    href: "/dashboard/usage",
    permission: "usage:read",
    icon: "monitoring",
  },
  {
    title: "Quota tracker",
    description: "Review provider account quotas and reset windows.",
    href: "/dashboard/quota",
    permission: "usage:read",
    icon: "data_usage",
  },
  {
    title: "Proxy infrastructure",
    description: "Manage proxy pools and provider network routing.",
    href: "/dashboard/proxy-pools",
    permission: "providers:read",
    icon: "lan",
  },
  {
    title: "System tools",
    description: "Open CLI tools, diagnostics, and host-level system integrations.",
    href: "/dashboard/cli-tools",
    permission: "system:read",
    icon: "terminal",
  },
  {
    title: "PXPipe service",
    description: "Inspect, install, start, restart, and monitor the PXPipe service.",
    href: "/dashboard/pxpipe",
    permission: "system:read",
    icon: "memory",
  },
  {
    title: "Media providers & web search",
    description: "Configure image, video, audio, web search, and other media providers.",
    href: "/dashboard/media-providers/web",
    permission: "integrations:read",
    icon: "extension",
  },
  {
    title: "Translation",
    description: "Manage the translation integration and language tools.",
    href: "/dashboard/translator",
    permission: "integrations:read",
    icon: "translate",
  },
  {
    title: "Application settings",
    description: "Review application preferences, network settings, and account configuration.",
    href: "/dashboard/profile",
    permission: "settings:read",
    icon: "settings",
  },
];

export default function AfgAiManagementCenterPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to read access status");
        if (!cancelled) setStatus(data);
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Unable to load management center"); });
    return () => { cancelled = true; };
  }, []);

  const allowed = useMemo(() => {
    if (status?.controlPlaneRole === "superadmin") return true;
    const permissions = status?.controlPlanePermissions;
    return (permission) => (
      (status?.controlPlaneRole === "admin" && ADMIN_ROLE_PERMISSIONS.has(permission)) ||
      (Array.isArray(permissions) && (permissions.includes("*") || permissions.includes(permission)))
    );
  }, [status]);

  if (error) {
    return <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>;
  }

  if (!status) {
    return <div className="py-12 text-sm text-text-muted">Loading AFG AI Management Center…</div>;
  }

  if (!status.controlPlaneMode || !status.authenticated) {
    return (
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold text-text-main">AFG AI Management Center</h1>
        <p className="mt-2 text-sm text-text-muted">The secure AFG AI control plane is not active for this session.</p>
      </div>
    );
  }

  const cards = MANAGEMENT_AREAS.filter((area) => allowed === true || allowed(area.permission));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">AFG AI · 9Router</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-text-main">Management Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              One secure browser portal for provider operations, routing, usage, integrations, and system administration.
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg px-3 py-2 text-xs text-text-muted">
            <span className="font-semibold text-text-main">{status.displayName || status.controlPlaneEmail || "Control-plane user"}</span>
            <span className="mx-2">·</span>
            <span className="text-primary font-semibold">{status.controlPlaneRole || "Staff"}</span>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-main">Management areas</h2>
          <span className="text-xs text-text-muted">{cards.length} areas available to this account</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map((area) => (
            <Link key={area.href} href={area.href} className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50 hover:bg-surface-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">{area.icon}</span>
                </div>
                <span className="material-symbols-outlined text-text-muted transition-transform group-hover:translate-x-1">arrow_forward</span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-text-main">{area.title}</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">{area.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {status.controlPlaneRole === "superadmin" && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Owner administration</h2>
              <p className="mt-1 text-xs text-text-muted">Create staff accounts, assign scopes, revoke sessions, and inspect audit activity.</p>
            </div>
            <Link href="/dashboard/admin/users" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">
              Staff & audit controls <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
