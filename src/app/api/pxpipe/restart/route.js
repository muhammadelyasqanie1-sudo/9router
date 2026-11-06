import { NextResponse } from "next/server";
import { recordControlPlaneSystemAction } from "@/lib/auth/controlPlaneAudit";
import { unloadPxpipe, loadPxpipe } from "@/lib/pxpipe/loader.js";
import { getPxpipeStatus } from "@/lib/pxpipe/service.js";

export const dynamic = "force-dynamic";

// Reload the in-process module (picks up an upgraded install without a server restart).
export async function POST(request) {
  try {
    unloadPxpipe();
    await loadPxpipe();
    await recordControlPlaneSystemAction(request, { action: "system.pxpipe.restart", targetType: "pxpipe" });
    return NextResponse.json(getPxpipeStatus());
  } catch (error) {
    return NextResponse.json({ error: error.message, code: error.code || null }, { status: 500 });
  }
}
