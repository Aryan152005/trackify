import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Custom Dashboard
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Drag, add, and remove widgets to build your perfect dashboard
            </p>
          </div>
        </div>
      </div>

      <CustomDashboardWrapper workspaceId={workspaceId} userId={user.id} />
    </div>
  );
}
