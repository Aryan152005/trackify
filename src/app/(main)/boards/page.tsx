import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { Plus, LayoutDashboard, Columns3 } from "lucide-react";

export default async function BoardsPage() {
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
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Boards
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Please select or create a workspace first.
            </p>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  const { data: boards } = await supabase
    .from("boards")
    .select("*, board_columns(id)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (
    <AnimatedPage>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Boards
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              Drag, drop, and organize your work visually
            </p>
          </div>
          <Link href="/boards/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Board
            </Button>
          </Link>
        </div>

        {/* Board grid */}
        {boards && boards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => {
              const columnCount = Array.isArray(board.board_columns)
                ? board.board_columns.length
                : 0;

              return (
                <Link key={board.id} href={`/boards/${board.id}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <LayoutDashboard className="h-5 w-5 text-indigo-500" />
                          <CardTitle className="line-clamp-1">
                            {board.name}
                          </CardTitle>
                        </div>
                      </div>
                      {board.description && (
                        <CardDescription className="line-clamp-2">
                          {board.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Columns3 className="h-3.5 w-3.5" />
                          {columnCount} {columnCount === 1 ? "column" : "columns"}
                        </span>
                        <span>
                          {format(parseISO(board.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <LayoutDashboard className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
              <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                No boards yet
              </h3>
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                Create your first Kanban board to start organizing tasks
                visually.
              </p>
              <Link href="/boards/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Board
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  );
}
