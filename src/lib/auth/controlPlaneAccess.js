import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getControlPlaneUserById } from "@/lib/db/repos/controlPlaneRepo";

export function isControlPlaneMode() {
  return process.env.AFG_AI_CONTROL_PLANE === "true";
}

export async function getControlPlaneActorFromToken(token) {
  const session = await getDashboardAuthSession(token);
  if (!session?.authenticated) return null;

  // Break-glass owner login via the existing dashboard master password.
  if (session.controlPlaneBootstrap === true && session.role === "superadmin") {
    return {
      id: "bootstrap",
      email: "owner@local",
      displayName: "AFG AI Owner",
      role: "superadmin",
      permissions: ["*"],
      isBootstrap: true,
    };
  }

  if (!session.controlPlaneUserId) return null;
  const user = await getControlPlaneUserById(session.controlPlaneUserId);
  if (!user || !user.isActive) return null;
  if (Number(session.tokenVersion) !== Number(user.tokenVersion)) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    permissions: user.permissions,
    isBootstrap: false,
  };
}

export async function getControlPlaneActor(request) {
  return getControlPlaneActorFromToken(request.cookies.get("auth_token")?.value);
}

const ADMIN_PERMISSIONS = new Set([
  "dashboard:access",
  "providers:read", "providers:manage",
  "routing:read", "routing:manage",
  "usage:read",
  "settings:read",
  "integrations:read", "integrations:manage",
  "afg-ai:read", "afg-ai:manage", "afg-ai:users:read", "afg-ai:users:manage", "afg-ai:subscriptions:read", "afg-ai:subscriptions:manage", "afg-ai:subscriptions:read", "afg-ai:subscriptions:manage",
]);

export function actorHasPermission(actor, permission) {
  if (!actor) return false;
  if (actor.role === "superadmin") return true;
  if (actor.role === "admin" && ADMIN_PERMISSIONS.has(permission)) return true;
  if (permission === "dashboard:access" && actor.role === "admin") return true;
  return Array.isArray(actor.permissions) &&
    (actor.permissions.includes("*") || actor.permissions.includes(permission));
}

const prefixes = {
  providers: ["/api/providers", "/api/provider-nodes", "/api/proxy-pools", "/api/oauth"],
  routing: ["/api/keys", "/api/models", "/api/combos", "/api/pricing", "/api/tags"],
  usage: ["/api/usage"],
  settings: ["/api/settings"],
  integrations: ["/api/cloud", "/api/media-providers", "/api/translator"],
  system: ["/api/cli-tools", "/api/mcp", "/api/tunnel", "/api/shutdown", "/api/version/shutdown", "/api/version/update", "/api/settings/database", "/api/headroom", "/api/pxpipe"],
};

export function isSuperadminOnlyControlPlaneRoute(pathname) {
  return pathname === "/api/settings/database" || pathname.startsWith("/api/settings/database/");
}

export function requiredControlPlanePermission(pathname, method = "GET") {
  if (pathname === "/control-plane") return "dashboard:access";
  const isRead = ["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase());
  if (pathname.startsWith("/api/admin/users")) return "users:manage";
  if (pathname.startsWith("/api/admin/audit")) return isRead ? "audit:read" : "system:manage";
  // Database export/import exposes every provider credential and can replace the
  // complete router database. Keep it owner-level, even for read-only exports.
  if (pathname === "/api/afg-ai/subscriptions" || pathname.startsWith("/api/afg-ai/subscriptions/")) return isRead ? "afg-ai:subscriptions:read" : "afg-ai:subscriptions:manage";
  if (pathname === "/api/afg-ai/subscriptions" || pathname.startsWith("/api/afg-ai/subscriptions/")) return isRead ? "afg-ai:subscriptions:read" : "afg-ai:subscriptions:manage";
  if (pathname === "/api/afg-ai/users" || pathname.startsWith("/api/afg-ai/users/")) return isRead ? "afg-ai:users:read" : "afg-ai:users:manage";
  if (pathname === "/api/afg-ai" || pathname.startsWith("/api/afg-ai/")) return isRead ? "afg-ai:read" : "afg-ai:manage";
  if (pathname === "/api/settings/database" || pathname.startsWith("/api/settings/database/")) return "system:manage";
  // OAuth routes can start authorization flows and create credentials even when the HTTP method is GET.
  if (pathname === "/api/oauth" || pathname.startsWith("/api/oauth/")) return "providers:manage";

  for (const [domain, paths] of Object.entries(prefixes)) {
    if (paths.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
      if (domain === "usage") return isRead ? "usage:read" : "usage:manage";
      if (domain === "system") return isRead ? "system:read" : "system:manage";
      return domain + (isRead ? ":read" : ":manage");
    }
  }

  // Unknown management endpoints are privileged by default.
  return "system:manage";
}
