import { redirect } from "next/navigation";

// The dedicated browser URL is protected by dashboardGuard and opens the
// permission-filtered management center after a valid control-plane login.
export const dynamic = "force-dynamic";

export default function ControlPlaneEntryPage() {
  redirect("/dashboard/admin");
}
