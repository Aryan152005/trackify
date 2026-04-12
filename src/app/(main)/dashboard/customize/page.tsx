import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { CustomDashboardWrapper } from "./custom-dashboard-wrapper";

export default async function CustomizeDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Dashboard"
        description="Drag, add, and remove widgets to build your perfect dashboard"
        backHref="/dashboard"
        backLabel="Back to Dashboard"
      />

      <CustomDashboardWrapper workspaceId={workspaceId} userId={user.id} />
    </div>
  );
}
