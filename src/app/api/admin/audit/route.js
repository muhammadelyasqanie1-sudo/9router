import { NextResponse } from "next/server";
import { getControlPlaneActor, actorHasPermission } from "@/lib/auth/controlPlaneAccess";
import { listControlPlaneAuditEvents } from "@/lib/db/repos/controlPlaneRepo";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const actor = await getControlPlaneActor(request);
  const canRead = actorHasPermission(actor, "audit:read");
  if (!canRead) return NextResponse.json({ error: "Audit access denied" }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));
  const events = await listControlPlaneAuditEvents(limit);
  return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
