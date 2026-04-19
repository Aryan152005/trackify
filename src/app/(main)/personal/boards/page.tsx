import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalBoards } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Columns3, Lock } from "lucide-react";

export default async function PersonalBoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="My Boards"
          description="Please select or create a workspace first."
        />
      </div>
    );
  }

  const boards = await getPersonalBoards(workspaceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Boards"
        description="Private kanban boards — only visible to you"
        actions={<Lock className="h-5 w-5 text-amber-500" />}
      />

      {boards && boards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} href={`/boards/${board.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Columns3 className="h-5 w-5 text-zinc-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">{board.name}</h3>
                      <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                    </div>
                    {board.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{board.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Edited {formatDistanceToNow(parseISO(board.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Columns3 className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">No private boards yet</h3>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Open any board and use the lock icon to mark it private. It will then appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
