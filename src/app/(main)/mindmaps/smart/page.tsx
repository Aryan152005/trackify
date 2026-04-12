import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { buildSmartGraph } from "@/lib/smart-mindmap/graph";
import { PageHeader } from "@/components/ui/page-header";
import { SmartMindMap } from "@/components/mindmaps/smart-mindmap";

export default async function SmartMindMapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();
  const graph = await buildSmartGraph(workspaceId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Smart Mindmap"
        description="Auto-generated from your tasks, reminders, entries, and notes. Click suggestions to auto-link related items."
        backHref="/mindmaps"
        backLabel="Back to Mindmaps"
      />
      <SmartMindMap graph={graph} workspaceId={workspaceId} />
    </div>
  );
}
