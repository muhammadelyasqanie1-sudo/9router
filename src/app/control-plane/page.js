import { redirect } from "next/navigation";

// Dedicated browser entry point. Authentication and superadmin authorization
// are enforced by dashboardGuard before this redirect is reached.
export const dynamic = "force-dynamic";

export default function ControlPlaneEntryPage() {
  redirect("/dashboard/admin/users");
}
