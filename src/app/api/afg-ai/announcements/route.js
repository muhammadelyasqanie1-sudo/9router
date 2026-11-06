import { NextResponse } from "next/server";
import { getControlPlaneActor, actorHasPermission } from "@/lib/auth/controlPlaneAccess";
import { writeControlPlaneAuditEvent } from "@/lib/db/repos/controlPlaneRepo";
import { getClientIp } from "@/lib/auth/loginLimiter";

export const dynamic = "force-dynamic";

function getUrl() {
  const raw = process.env.AFG_AI_ADMIN_API_URL || "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.pathname = "/api/internal/9router/announcements";
    return url;
  } catch { return null; }
}

export async function GET(request) { return handle(request, "GET"); }
export async function POST(request) { return handle(request, "POST"); }

async function handle(request, method) {
  const actor = await getControlPlaneActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const permission = method === "GET" ? "afg-ai:announcements:read" : "afg-ai:announcements:manage";
  if (!actorHasPermission(actor, permission)) return NextResponse.json({ error: "AFG AI announcement permission required." }, { status: 403 });
  const token = process.env.AFG_AI_9ROUTER_BRIDGE_TOKEN || "";
  const url = getUrl();
  if (token.length < 32 || !url) return NextResponse.json({ available: false, error: "AFG AI private bridge is not configured." }, { status: 503 });

  let body;
  if (method === "POST") {
    body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.title !== "string" || typeof body.body !== "string") {
      return NextResponse.json({ error: "Announcement title and body are required." }, { status: 400 });
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-9Router-Actor-Id": String(actor.id).slice(0, 128),
        "X-9Router-Actor-Email": String(actor.email).slice(0, 254),
        "X-9Router-Actor-Role": String(actor.role).slice(0, 32),
        "X-9Router-Actor-Permissions": JSON.stringify(Array.isArray(actor.permissions) ? actor.permissions : []),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 128 * 1024) return NextResponse.json({ error: "AFG AI response exceeded the safety limit." }, { status: 502 });
    const data = JSON.parse(bytes.toString("utf8") || "{}");
    if (!response.ok) {
      const safeStatus = [400, 401, 403].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: typeof data.error === "string" ? data.error.slice(0, 240) : "AFG AI announcement operation failed." }, { status: safeStatus });
    }
    await writeControlPlaneAuditEvent({
      actorId: actor.id, actorEmail: actor.email,
      action: method === "GET" ? "afg_ai.announcements.list" : "afg_ai.announcement.create",
      targetType: "afg_ai_announcements", targetId: method === "GET" ? "list" : String(data.announcement?.id || "created"),
      details: method === "GET" ? { result: "success" } : { titleLength: body.title.trim().length, result: "success" },
      clientIp: getClientIp(request),
    });
    return NextResponse.json(data, { status: method === "POST" ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach AFG AI announcements service." }, { status: 502 });
  }
}
