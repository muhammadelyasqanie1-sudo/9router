import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getControlPlaneActor } from "@/lib/auth/controlPlaneAccess";
import {
  CONTROL_PLANE_PERMISSIONS,
  getControlPlaneUserById,
  updateControlPlaneUser,
  writeControlPlaneAuditEvent,
} from "@/lib/db/repos/controlPlaneRepo";
import { getClientIp } from "@/lib/auth/loginLimiter";

export const dynamic = "force-dynamic";
const jsonHeaders = { "Cache-Control": "no-store" };

export async function PATCH(request, { params }) {
  const actor = await getControlPlaneActor(request);
  if (actor?.role !== "superadmin") return NextResponse.json({ error: "Superadministrator required" }, { status: 403, headers: jsonHeaders });

  try {
    const { id } = await params;
    const current = await getControlPlaneUserById(id);
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404, headers: jsonHeaders });
    if (current.role === "superadmin") return NextResponse.json({ error: "Owner superadministrator accounts cannot be modified here" }, { status: 403, headers: jsonHeaders });

    const body = await request.json();
    const updates = {};
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (!name || name.length > 80) return NextResponse.json({ error: "Display name must contain 1–80 characters" }, { status: 400, headers: jsonHeaders });
      updates.displayName = name;
    }
    if (body.role !== undefined) {
      if (!["admin", "staff"].includes(body.role)) return NextResponse.json({ error: "Role must be admin or staff" }, { status: 400, headers: jsonHeaders });
      updates.role = body.role;
    }
    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions) || body.permissions.some((p) => !CONTROL_PLANE_PERMISSIONS.includes(p))) {
        return NextResponse.json({ error: "One or more permissions are invalid" }, { status: 400, headers: jsonHeaders });
      }
      updates.permissions = JSON.stringify([...new Set(body.permissions)]);
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive must be boolean" }, { status: 400, headers: jsonHeaders });
      updates.isActive = body.isActive ? 1 : 0;
    }
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 12) return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400, headers: jsonHeaders });
      updates.passwordHash = await bcrypt.hash(body.password, await bcrypt.genSalt(12));
    }

    const authorizationChanged = ["role", "permissions", "isActive", "password"].some((key) => body[key] !== undefined);
    if (authorizationChanged) updates.tokenVersion = Number(current.tokenVersion || 0) + 1;

    const updated = await updateControlPlaneUser(id, updates);
    await writeControlPlaneAuditEvent({
      actorId: actor.id, actorEmail: actor.email, action: "users.update",
      targetType: "user", targetId: id,
      details: { changedFields: Object.keys(body).filter((k) => ["displayName", "role", "permissions", "isActive", "password"].includes(k)) },
      clientIp: getClientIp(request),
    });
    return NextResponse.json({ user: updated }, { headers: jsonHeaders });
  } catch (error) {
    console.error("[control-plane] update user failed:", error);
    return NextResponse.json({ error: "Unable to update account" }, { status: 500, headers: jsonHeaders });
  }
}

export async function DELETE(request, { params }) {
  const actor = await getControlPlaneActor(request);
  if (actor?.role !== "superadmin") return NextResponse.json({ error: "Superadministrator required" }, { status: 403, headers: jsonHeaders });

  const { id } = await params;
  const current = await getControlPlaneUserById(id);
  if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404, headers: jsonHeaders });
  if (current.role === "superadmin") return NextResponse.json({ error: "Owner superadministrator accounts cannot be disabled here" }, { status: 403, headers: jsonHeaders });

  const updated = await updateControlPlaneUser(id, {
    isActive: 0,
    tokenVersion: Number(current.tokenVersion || 0) + 1,
  });
  await writeControlPlaneAuditEvent({
    actorId: actor.id, actorEmail: actor.email, action: "users.disable",
    targetType: "user", targetId: id,
    details: { email: current.email, previousRole: current.role },
    clientIp: getClientIp(request),
  });
  return NextResponse.json({ user: updated }, { headers: jsonHeaders });
}
