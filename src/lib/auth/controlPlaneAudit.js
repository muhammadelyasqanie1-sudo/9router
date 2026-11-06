import { getControlPlaneActor } from "@/lib/auth/controlPlaneAccess";
import { writeControlPlaneAuditEvent } from "@/lib/db/repos/controlPlaneRepo";
import { getClientIp } from "@/lib/auth/loginLimiter";

/**
 * Record safe metadata for a successful privileged system action.
 * Callers must never pass credentials, tokens, raw command output, or proxy URLs.
 */
export async function recordControlPlaneSystemAction(request, event) {
  const actor = await getControlPlaneActor(request);
  if (!actor) return;
  await writeControlPlaneAuditEvent({
    actorId: actor.id,
    actorEmail: actor.email,
    action: String(event.action || "system.action"),
    targetType: event.targetType || "system",
    targetId: event.targetId || null,
    details: event.details || {},
    clientIp: getClientIp(request),
  });
}
