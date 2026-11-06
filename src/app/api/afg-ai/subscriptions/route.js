import { NextResponse } from "next/server";
import { getControlPlaneActor, actorHasPermission } from "@/lib/auth/controlPlaneAccess";
import { writeControlPlaneAuditEvent } from "@/lib/db/repos/controlPlaneRepo";
import { getClientIp } from "@/lib/auth/loginLimiter";

export const dynamic = "force-dynamic";

function getUpstreamUrl() {
  const raw = process.env.AFG_AI_ADMIN_API_URL || "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.pathname = "/api/internal/9router/subscriptions";
    return url;
  } catch { return null; }
}

function actorHeaders(actor, token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-9Router-Actor-Id": String(actor.id).slice(0, 128),
    "X-9Router-Actor-Email": String(actor.email).slice(0, 254),
    "X-9Router-Actor-Role": String(actor.role).slice(0, 32),
    "X-9Router-Actor-Permissions": JSON.stringify(Array.isArray(actor.permissions) ? actor.permissions : []),
  };
}

async function handle(request, method) {
  const actor = await getControlPlaneActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const permission = method === "GET" ? "afg-ai:subscriptions:read" : "afg-ai:subscriptions:manage";
  if (!actorHasPermission(actor, permission)) {
    return NextResponse.json({ error: "The required AFG AI subscription permission is missing." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const token = process.env.AFG_AI_9ROUTER_BRIDGE_TOKEN || "";
  const url = getUpstreamUrl();
  if (token.length < 32 || !url) {
    return NextResponse.json({ available: false, error: "AFG AI private bridge is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let body;
  if (method === "PATCH") {
    body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof body.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.userId) ||
        !["free", "pro"].includes(body.planKey)) {
      return NextResponse.json({ error: "Provide a user ID and an enabled free or pro plan." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: actorHeaders(actor, token),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 256 * 1024) {
      return NextResponse.json({ error: "AFG AI response exceeded the safety limit." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const data = JSON.parse(bytes.toString("utf8") || "{}");
    if (!response.ok) {
      const safeStatus = [400, 401, 403, 404, 409].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: typeof data.error === "string" ? data.error.slice(0, 240) : "AFG AI subscription operation failed." }, { status: safeStatus, headers: { "Cache-Control": "no-store" } });
    }

    await writeControlPlaneAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      action: method === "GET" ? "afg_ai.subscriptions.list" : "afg_ai.subscription.plan.assign",
      targetType: method === "GET" ? "afg_ai_subscriptions" : "afg_ai_user_subscription",
      targetId: method === "GET" ? "list" : body.userId,
      details: method === "GET" ? { result: "success" } : { planKey: body.planKey, result: "success" },
      clientIp: getClientIp(request),
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach AFG AI subscription service." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request) { return handle(request, "GET"); }
export async function PATCH(request) { return handle(request, "PATCH"); }
