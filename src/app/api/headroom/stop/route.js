import { NextResponse } from "next/server";
import { recordControlPlaneSystemAction } from "@/lib/auth/controlPlaneAudit";
import { stopHeadroomProxy } from "@/lib/headroom/process";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const result = stopHeadroomProxy();
    const status = result.stopped ? 200 : 409;
    if (result.stopped) {
      await recordControlPlaneSystemAction(request, { action: "system.headroom.stop", targetType: "headroom_proxy" });
    }
    return NextResponse.json({ ...result }, { status });
  } catch (error) {
    return NextResponse.json({ error: error.message, code: error.code || null }, { status: 500 });
  }
}
