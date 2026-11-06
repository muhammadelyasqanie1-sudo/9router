import { describe, expect, it } from "vitest";
import { requiredControlPlanePermission, isSuperadminOnlyControlPlaneRoute } from "../../src/lib/auth/controlPlaneAccess.js";

describe("control-plane permission mapping", () => {
  it("keeps database export and import owner-level for every method", () => {
    expect(requiredControlPlanePermission("/api/settings/database", "GET")).toBe("system:manage");
    expect(requiredControlPlanePermission("/api/settings/database", "POST")).toBe("system:manage");
  });

  it("separates usage reads from credit-consuming reset operations", () => {
    expect(requiredControlPlanePermission("/api/usage/stats", "GET")).toBe("usage:read");
    expect(requiredControlPlanePermission("/api/usage/123/claude-reset", "POST")).toBe("usage:manage");
    expect(requiredControlPlanePermission("/api/usage/123/codex-reset-credits", "POST")).toBe("usage:manage");
  });

  it("preserves ordinary settings read/manage scopes", () => {
    expect(requiredControlPlanePermission("/api/settings", "GET")).toBe("settings:read");
    expect(requiredControlPlanePermission("/api/settings", "PATCH")).toBe("settings:manage");
  });

  it("uses dedicated AFG AI subscription read and manage scopes", () => {
    expect(requiredControlPlanePermission("/api/afg-ai/subscriptions", "GET")).toBe("afg-ai:subscriptions:read");
    expect(requiredControlPlanePermission("/api/afg-ai/subscriptions", "PATCH")).toBe("afg-ai:subscriptions:manage");
  });

  it("uses dedicated AFG AI subscription read and manage scopes", () => {
    expect(requiredControlPlanePermission("/api/afg-ai/subscriptions", "GET")).toBe("afg-ai:subscriptions:read");
    expect(requiredControlPlanePermission("/api/afg-ai/subscriptions", "PATCH")).toBe("afg-ai:subscriptions:manage");
  });

  it("uses dedicated AFG AI user read and manage scopes", () => {
    expect(requiredControlPlanePermission("/api/afg-ai/users", "GET")).toBe("afg-ai:users:read");
    expect(requiredControlPlanePermission("/api/afg-ai/users", "PATCH")).toBe("afg-ai:users:manage");
  });

  it("uses dedicated AFG AI read and manage scopes", () => {
    expect(requiredControlPlanePermission("/api/afg-ai/overview", "GET")).toBe("afg-ai:read");
    expect(requiredControlPlanePermission("/api/afg-ai/settings", "PATCH")).toBe("afg-ai:manage");
  });

  it("requires provider management scope for OAuth GET and POST actions", () => {
    expect(requiredControlPlanePermission("/api/oauth/codex/authorize", "GET")).toBe("providers:manage");
    expect(requiredControlPlanePermission("/api/oauth/codex/start-proxy", "GET")).toBe("providers:manage");
    expect(requiredControlPlanePermission("/api/oauth/codex/exchange", "POST")).toBe("providers:manage");
  });

  it("keeps audit reads separate from audit mutations", () => {
    expect(requiredControlPlanePermission("/api/admin/audit", "GET")).toBe("audit:read");
    expect(requiredControlPlanePermission("/api/admin/audit", "POST")).toBe("system:manage");
  });

  it("marks database export/import as superadmin-only, not merely system-scoped", () => {
    expect(isSuperadminOnlyControlPlaneRoute("/api/settings/database")).toBe(true);
    expect(isSuperadminOnlyControlPlaneRoute("/api/settings/database/backup")).toBe(true);
    expect(isSuperadminOnlyControlPlaneRoute("/api/settings")).toBe(false);
  });

  it("fails closed for unknown management endpoints", () => {
    expect(requiredControlPlanePermission("/api/new-sensitive-route", "GET")).toBe("system:manage");
  });
});
