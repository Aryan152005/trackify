"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { createPage } from "@/lib/notes/actions";
import { Loader2 } from "lucide-react";

export default function NewNotePage() {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const creating = useRef(false);

  useEffect(() => {
    if (!workspaceId || creating.current) return;
    creating.current = true;

    createPage(workspaceId)
      .then((page) => {
        router.replace(`/notes/${page.id}`);
      })
      .catch(() => {
        router.replace("/notes");
      });
  }, [workspaceId, router]);

  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Creating new page...
        </p>
      </div>
    </div>
  );
}
