import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getControlPlaneActor } from "@/lib/auth/controlPlaneAccess";
import {
  CONTROL_PLANE_PERMISSIONS,
  createControlPlaneUser,
  listControlPlaneUsers,
  writeControlPlaneAuditEvent,
} from "@/lib/db/repos/controlPlaneRepo";
import { getClientIp } from "@/lib/auth/loginLimiter";

export const dynamic = "force-dynamic";
const jsonHeaders = { "Cache-Control": "no-store" };

function isSuperadmin(actor) {
  return actor?.role === "superadmin";
}

export async function GET(request) {
  const actor = await getControlPlaneActor(request);
  if (!isSuperadmin(actor)) return NextResponse.json({ error: "Superadministrator required" }, { status: 403, headers: jsonHeaders });
  return NextResponse.json({ users: await listControlPlaneUsers() }, { headers: jsonHeaders });
}

export async function POST(request) {
  const actor = await getControlPlaneActor(request);
  if (!isSuperadmin(actor)) return NextResponse.json({ error: "Superadministrator required" }, { status: 403, headers: jsonHeaders });

  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : body.role === "staff" ? "staff" : "";
    const permissions = body.permissions ?? [];

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400, headers: jsonHeaders });
    }
    if (!displayName || displayName.length > 80) {
      return NextResponse.json({ error: "Display name must contain 1–80 characters" }, { status: 400, headers: jsonHeaders });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400, headers: jsonHeaders });
    }
    if (!role) {
      return NextResponse.json({ error: "Role must be admin or staff. Superadmin is reserved for the owner." }, { status: 400, headers: jsonHeaders });
    }
    if (!Array.isArray(permissions) || permissions.some((p) => !CONTROL_PLANE_PERMISSIONS.includes(p))) {
      return NextResponse.json({ error: "One or more permissions are invalid" }, { status: 400, headers: jsonHeaders });
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
    const user = await createControlPlaneUser({ email, displayName, passwordHash, role, permissions });
    await writeControlPlaneAuditEvent({
      actorId: actor.id, actorEmail: actor.email, action: "users.create",
      targetType: "user", targetId: user.id,
      details: { email: user.email, role: user.role, permissions: user.permissions },
      clientIp: getClientIp(request),
    });
    return NextResponse.json({ user }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    if (/UNIQUE constraint failed|unique/i.test(error.message || "")) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409, headers: jsonHeaders });
    }
    console.error("[control-plane] create user failed:", error);
    return NextResponse.json({ error: "Unable to create account" }, { status: 500, headers: jsonHeaders });
  }
}
