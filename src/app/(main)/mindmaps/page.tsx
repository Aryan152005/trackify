import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AnimatedPage,
  AnimatedList,
  AnimatedItem,
} from "@/components/ui/animated-layout";
import { Plus, Brain } from "lucide-react";
import { createMindMap } from "@/lib/mindmaps/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedSection } from "@/components/collaboration/shared-section";
import { buildSmartGraph } from "@/lib/smart-mindmap/graph";
import { SmartMindMapSection } from "@/components/mindmaps/smart-mindmap-section";

export default async function MindMapsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <AnimatedPage>
        <div className="space-y-8">
          <PageHeader
            title="Mind Maps"
            description="Please select or create a workspace first."
          />
        </div>
      </AnimatedPage>
    );
  }

  // Fetch both surfaces in parallel: the auto-built smart graph (always
  // visible at the top of this page) AND the user's saved mind maps below.
  const [smartGraph, { data: mindmaps }] = await Promise.all([
    buildSmartGraph(workspaceId),
    supabase
      .from("mindmaps")
      .select("id, title, description, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
  ]);

  async function handleCreate() {
    "use server";
    const wsId = await getActiveWorkspaceId();
    if (!wsId) throw new Error("No active workspace");
    const mindmap = await createMindMap(wsId);
    redirect(`/mindmaps/${mindmap.id}`);
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Mind Maps"
          description="The smart map below auto-builds from your work. Create your own maps beneath it."
          actions={
            <form action={handleCreate}>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                New Mind Map
              </Button>
            </form>
          }
        />

        {/* Smart mindmap — auto-generated, collapsible, always on this page. */}
        <SmartMindMapSection graph={smartGraph} workspaceId={workspaceId} />

        {/* Divider + section label for user-created maps. */}
        <div className="flex items-end justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Your mind maps
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manual brainstorms you&apos;ve drawn yourself{mindmaps && mindmaps.length > 0 ? ` · ${mindmaps.length}` : ""}
            </p>
          </div>
          {mindmaps && mindmaps.length > 0 && (
            <form action={handleCreate}>
              <Button type="submit" variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New
              </Button>
            </form>
          )}
        </div>

        {/* Mind maps grid */}
        {mindmaps && mindmaps.length > 0 ? (
          <AnimatedList>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mindmaps.map((mindmap) => (
                <AnimatedItem key={mindmap.id}>
                  <Link href={`/mindmaps/${mindmap.id}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
                          <Brain className="h-5 w-5 text-indigo-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                            {mindmap.title || "Untitled"}
                          </h3>
                          {mindmap.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {mindmap.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                            Edited{" "}
                            {formatDistanceToNow(parseISO(mindmap.updated_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </AnimatedItem>
              ))}
            </div>
          </AnimatedList>
        ) : (
          <EmptyState
            icon={<Brain className="h-6 w-6" />}
            title="No mind maps yet"
            description="Create your first mind map to start brainstorming and organizing ideas visually."
          >
            <form action={handleCreate} className="mt-2">
              <Button type="submit" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Mind Map
              </Button>
            </form>
          </EmptyState>
        )}

        <SharedSection entityType="mindmap" />
      </div>
    </AnimatedPage>
  );
}
