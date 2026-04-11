import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskAutomations } from "@/components/tasks/task-automations";
import { ArrowLeft } from "lucide-react";

export default async function TaskAutomationsPage() {
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
  if (!workspaceId) redirect("/tasks");

  return (
    <div className="space-y-6">
      <Link href="/tasks">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tasks
        </Button>
      </Link>

      <TaskAutomations workspaceId={workspaceId} />
    </div>
  );
}
