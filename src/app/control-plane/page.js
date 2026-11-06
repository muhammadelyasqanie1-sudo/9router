import { redirect } from "next/navigation";

// Keep the dedicated browser entry disabled unless the control-plane security
// mode is explicitly enabled by the deployment operator.
export const dynamic = "force-dynamic";

export default function ControlPlaneEntryPage() {
  if (process.env.AFG_AI_CONTROL_PLANE !== "true") redirect("/login");
  redirect("/dashboard/admin");
}
