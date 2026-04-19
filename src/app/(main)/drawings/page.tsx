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
import { Plus, Pencil } from "lucide-react";
import { createDrawing } from "@/lib/drawings/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedSection } from "@/components/collaboration/shared-section";

export default async function DrawingsPage() {
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
            title="Drawings"
            description="Please select or create a workspace first."
          />
        </div>
      </AnimatedPage>
    );
  }

  const { data: drawings } = await supabase
    .from("drawings")
    .select("id, title, thumbnail_url, updated_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  async function handleCreate() {
    "use server";
    const wsId = await getActiveWorkspaceId();
    if (!wsId) throw new Error("No active workspace");
    const drawing = await createDrawing(wsId);
    redirect(`/drawings/${drawing.id}`);
  }

  return (
    <AnimatedPage>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Drawings"
          description="Collaborative whiteboard and sketching"
          actions={
            <form action={handleCreate}>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                New Drawing
              </Button>
            </form>
          }
        />

        <SharedSection entityType="drawing" />

        {/* Drawings grid */}
        {drawings && drawings.length > 0 ? (
          <AnimatedList>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drawings.map((drawing) => (
                <AnimatedItem key={drawing.id}>
                  <Link href={`/drawings/${drawing.id}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
                          <Pencil className="h-5 w-5 text-indigo-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                            {drawing.title || "Untitled"}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                            Edited{" "}
                            {formatDistanceToNow(parseISO(drawing.updated_at), {
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
            icon={<Pencil className="h-6 w-6" />}
            title="No drawings yet"
            description="Create your first drawing to start sketching and collaborating visually."
            hint="Whiteboard a system, doodle an idea, sketch a flow — Excalidraw + realtime collab means teammates see your strokes as they land."
          >
            <form action={handleCreate} className="mt-2">
              <Button type="submit" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Drawing
              </Button>
            </form>
          </EmptyState>
        )}
      </div>
    </AnimatedPage>
  );
}
