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
import { Plus, Brain, Sparkles } from "lucide-react";
import { createMindMap } from "@/lib/mindmaps/actions";

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

  const { data: mindmaps } = await supabase
    .from("mindmaps")
    .select("id, title, description, updated_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  async function handleCreate() {
    "use server";
    const wsId = await getActiveWorkspaceId();
    if (!wsId) throw new Error("No active workspace");
    const mindmap = await createMindMap(wsId);
    redirect(`/mindmaps/${mindmap.id}`);
  }

  return (
    <AnimatedPage>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Mind Maps"
          description="Visual brainstorming and idea organization"
          actions={
            <>
              <Link href="/mindmaps/smart">
                <Button variant="outline">
                  <Sparkles className="mr-2 h-4 w-4 text-indigo-500" />
                  Smart Mindmap
                </Button>
              </Link>
              <form action={handleCreate}>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  New Mind Map
                </Button>
              </form>
            </>
          }
        />

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
          /* Empty state */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Brain className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
              <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                No mind maps yet
              </h3>
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                Create your first mind map to start brainstorming and organizing
                ideas visually.
              </p>
              <form action={handleCreate}>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  New Mind Map
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  );
}
