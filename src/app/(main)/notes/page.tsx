import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated-layout";
import { Plus, FileText, StickyNote } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotesPage() {
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
            title="Notes"
            description="Please select or create a workspace first."
          />
        </div>
      </AnimatedPage>
    );
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, icon, updated_at, parent_page_id")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  return (
    <AnimatedPage>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Notes"
          description="Your second brain — capture ideas, write docs, plan anything"
          actions={
            <Link href="/notes/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Page
              </Button>
            </Link>
          }
        />

        {/* Pages list */}
        {pages && pages.length > 0 ? (
          <AnimatedList>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.map((page) => (
                <AnimatedItem key={page.id}>
                  <Link href={`/notes/${page.id}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800">
                          {page.icon || <FileText className="h-5 w-5 text-zinc-400" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                            {page.title || "Untitled"}
                          </h3>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            Edited{" "}
                            {formatDistanceToNow(parseISO(page.updated_at), {
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
            icon={<StickyNote className="h-6 w-6" />}
            title="No pages yet"
            description="Create your first page to start writing and organizing your notes."
            actionLabel="New Page"
            actionHref="/notes/new"
          />
        )}
      </div>
    </AnimatedPage>
  );
}
