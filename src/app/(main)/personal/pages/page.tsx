import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalPages } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, Lock } from "lucide-react";

export default async function PersonalPagesPage() {
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
          title="My Pages"
          description="Please select or create a workspace first."
        />
      </div>
    );
  }

  const pages = await getPersonalPages(workspaceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Pages"
        description="Your private pages — only visible to you"
      />

      {pages && pages.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.id} href={`/notes/${page.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800">
                    {page.icon || (
                      <FileText className="h-5 w-5 text-zinc-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                        {page.title || "Untitled"}
                      </h3>
                      <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                    </div>
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
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              No private pages yet
            </h3>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Go to Notes and use the lock icon on any page to make it private.
              It will then appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
