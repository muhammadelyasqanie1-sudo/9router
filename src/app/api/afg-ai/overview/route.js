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
    if (
      url.protocol !== "https:" ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== "/api/internal/9router/overview"
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const actor = await getControlPlaneActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!actorHasPermission(actor, "afg-ai:read")) {
    return NextResponse.json({ error: "AFG AI read permission required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const token = process.env.AFG_AI_9ROUTER_BRIDGE_TOKEN || "";
  const url = getUpstreamUrl();
  if (token.length < 32 || !url) {
    return NextResponse.json({ available: false, configured: false, error: "AFG AI private bridge is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 64 * 1024) {
      return NextResponse.json({ available: false, error: "AFG AI response exceeded the safety limit." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    if (!response.ok) {
      return NextResponse.json({ available: false, error: response.status === 401 ? "AFG AI bridge credentials were rejected." : "AFG AI management service is unavailable." }, { status: response.status === 401 ? 502 : 503, headers: { "Cache-Control": "no-store" } });
    }
    const data = JSON.parse(bytes.toString("utf8"));
    if (data?.available !== true || data?.service !== "AFG AI") {
      return NextResponse.json({ available: false, error: "AFG AI returned an invalid management response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    await writeControlPlaneAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "afg_ai.overview.read",
      targetType: "afg_ai_platform",
      targetId: "overview",
      details: { result: "success" },
      clientIp: getClientIp(request),
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ available: false, error: "Could not reach AFG AI management service." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
