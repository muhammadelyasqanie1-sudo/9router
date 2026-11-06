import { describe, expect, it } from "vitest";
import { requiredControlPlanePermission } from "../../src/lib/auth/controlPlaneAccess.js";

describe("control-plane permission mapping", () => {
  it("keeps database export and import owner-level for every method", () => {
    expect(requiredControlPlanePermission("/api/settings/database", "GET")).toBe("system:manage");
    expect(requiredControlPlanePermission("/api/settings/database", "POST")).toBe("system:manage");
  });

  it("preserves ordinary settings read/manage scopes", () => {
    expect(requiredControlPlanePermission("/api/settings", "GET")).toBe("settings:read");
    expect(requiredControlPlanePermission("/api/settings", "PATCH")).toBe("settings:manage");
  });

  it("keeps audit reads separate from audit mutations", () => {
    expect(requiredControlPlanePermission("/api/admin/audit", "GET")).toBe("audit:read");
    expect(requiredControlPlanePermission("/api/admin/audit", "POST")).toBe("system:manage");
  });

  it("fails closed for unknown management endpoints", () => {
    expect(requiredControlPlanePermission("/api/new-sensitive-route", "GET")).toBe("system:manage");
  });
});
