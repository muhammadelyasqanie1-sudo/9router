import { NextResponse } from "next/server";
import { recordControlPlaneSystemAction } from "@/lib/auth/controlPlaneAudit";
import { unloadPxpipe } from "@/lib/pxpipe/loader.js";
import { getPxpipeStatus } from "@/lib/pxpipe/service.js";

export const dynamic = "force-dynamic";

// "Stop" in library mode = drop the in-process module; requests fail open to
// uncompressed passthrough until it is started again.
export async function POST(request) {
  try {
    const wasLoaded = unloadPxpipe();
    if (wasLoaded) {
      await recordControlPlaneSystemAction(request, { action: "system.pxpipe.stop", targetType: "pxpipe" });
    }
    return NextResponse.json({ stopped: wasLoaded, ...getPxpipeStatus() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
