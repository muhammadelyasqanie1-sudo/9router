import { NextResponse } from "next/server";
import { recordControlPlaneSystemAction } from "@/lib/auth/controlPlaneAudit";
import { getSettings } from "@/lib/localDb";
import { getInstallInfo, installPxpipe } from "@/lib/pxpipe/install.js";
import { loadPxpipe } from "@/lib/pxpipe/loader.js";
import { getPxpipeStatus } from "@/lib/pxpipe/service.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Start" in library mode = warm the in-process transform module.
// Auto-installs first when the package is missing and pxpipeAutoInstall is on.
export async function POST(request) {
  try {
    if (!getInstallInfo().installed) {
      const settings = await getSettings();
      if (!settings.pxpipeAutoInstall) {
        return NextResponse.json({ error: "PXPIPE is not installed", code: "NOT_INSTALLED" }, { status: 409 });
      }
      await installPxpipe();
    }
    await loadPxpipe();
    await recordControlPlaneSystemAction(request, { action: "system.pxpipe.start", targetType: "pxpipe" });
    return NextResponse.json(getPxpipeStatus());
  } catch (error) {
    return NextResponse.json({ error: error.message, code: error.code || null }, { status: 500 });
  }
}
