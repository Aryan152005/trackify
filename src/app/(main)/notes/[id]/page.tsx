"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { updatePageContent, updatePageTitle, updatePageMeta, createPage, createPageFromTemplate, extractChecklistAsTasks } from "@/lib/notes/actions";
import { toast } from "sonner";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { PageHeader } from "@/components/notes/page-header";
import { PageSidebar } from "@/components/notes/page-sidebar";
import { Loader2 } from "lucide-react";
import type { Page } from "@/lib/types/page";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";
import { NoteHistoryPanel } from "@/components/notes/note-history-panel";
import { Button } from "@/components/ui/button";
import { History, ListChecks } from "lucide-react";
import { PrivateToggle } from "@/components/personal/private-toggle";

const BlockEditor = dynamic(
  () =>
    import("@/components/notes/block-editor").then((m) => ({
      default: m.BlockEditor,
    })),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="space-y-3 py-4">
      <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-5 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.id as string;
  const workspaceId = useWorkspaceId();

  const [page, setPage] = useState<Page | null>(null);
  const [sidebarPages, setSidebarPages] = useState<
    { id: string; title: string; icon: string | null; parent_page_id: string | null }[]
  >([]);
  const [sidebarTemplates, setSidebarTemplates] = useState<
    { id: string; title: string; icon: string | null; parent_page_id: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Debounce timers
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------------
  // Fetch page data
  // ------------------------------------------------------------------

  const fetchPage = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("id", pageId)
      .single();

    if (error || !data) {
      router.push("/notes");
      return;
    }

    setPage(data as Page);
    setTitle(data.title ?? "");
    setLoading(false);
  }, [pageId, router]);

  const fetchSidebarPages = useCallback(async () => {
    if (!workspaceId) return;
    const supabase = createClient();

    const { data } = await supabase
      .from("pages")
      .select("id, title, icon, parent_page_id, is_template")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("title");

    if (data) {
      // Split real pages from templates so the sidebar can render them separately
      setSidebarPages(data.filter((p) => !p.is_template));
      setSidebarTemplates(data.filter((p) => p.is_template));
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    fetchSidebarPages();
  }, [fetchSidebarPages]);

  // Live updates: if another user renames / changes icon / archives the same
  // page, reflect it in this tab without a manual refresh. Body content edits
  // sync via BlockNote's own collab plug-in separately.
  useEffect(() => {
    if (!pageId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`page-${pageId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pages", filter: `id=eq.${pageId}` },
        (payload) => {
          const next = payload.new as Partial<Page>;
          if (next.title !== undefined) setTitle(next.title ?? "");
          setPage((prev) => (prev ? { ...prev, ...next } as Page : prev));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pageId]);

  // Live page-tree updates: any create/rename/archive/delete by anyone in the
  // current workspace refreshes the sidebar list.
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`pages-sidebar-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pages", filter: `workspace_id=eq.${workspaceId}` },
        () => { fetchSidebarPages(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchSidebarPages]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // Auto-save helpers
  // ------------------------------------------------------------------

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const handleContentChange = useCallback(
    (content: unknown[]) => {
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);

      contentTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updatePageContent(pageId, content);
          markSaved();
        } catch {
          setSaveStatus("idle");
        }
      }, 1500);
    },
    [pageId, markSaved]
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);

      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);

      titleTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updatePageTitle(pageId, newTitle);
          markSaved();
          // Update sidebar
          setSidebarPages((prev) =>
            prev.map((p) => (p.id === pageId ? { ...p, title: newTitle } : p))
          );
        } catch {
          setSaveStatus("idle");
        }
      }, 1500);
    },
    [pageId, markSaved]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      setPage((prev) => (prev ? { ...prev, icon } : prev));
      setSaveStatus("saving");
      try {
        await updatePageMeta(pageId, { icon });
        markSaved();
        setSidebarPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, icon } : p))
        );
      } catch {
        setSaveStatus("idle");
      }
    },
    [pageId, markSaved]
  );

  const handleCreatePage = useCallback(
    async (parentId?: string) => {
      if (!workspaceId) return;
      try {
        const newPage = await createPage(workspaceId, undefined, parentId);
        await fetchSidebarPages();
        router.push(`/notes/${newPage.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create page");
      }
    },
    [workspaceId, router, fetchSidebarPages]
  );

  const handleCreateFromTemplate = useCallback(
    async (templateId: string) => {
      if (!workspaceId) return;
      try {
        const newPage = await createPageFromTemplate(templateId, workspaceId);
        toast.success(`Created "${newPage.title}" from template`);
        await fetchSidebarPages();
        router.push(`/notes/${newPage.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create page from template");
      }
    },
    [workspaceId, router, fetchSidebarPages]
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <AnimatedPage>
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <PageSidebar
              pages={sidebarPages}
              templates={sidebarTemplates}
              currentPageId={pageId}
              onCreatePage={handleCreatePage}
              onCreateFromTemplate={handleCreateFromTemplate}
            />
          </div>
        </aside>

        {/* Main editor area */}
        <div className="min-w-0 flex-1">
          <PageHeader
            title={title}
            icon={page.icon}
            saveStatus={saveStatus}
            onTitleChange={handleTitleChange}
            onIconChange={handleIconChange}
          />

          <div className="flex items-center gap-2">
            <CollaborationToolbar
              entityType="page"
              entityId={pageId}
              entityTitle={title || "Untitled"}
              showCursors={false}
            />
            <PrivateToggle
              entityType="pages"
              entityId={pageId}
              isPrivate={!!(page as unknown as { is_private?: boolean }).is_private}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              title="See who created and edited this page"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Auto-save runs on a 1.5s debounce, so if the user
                // just typed boxes they may need to wait. The server
                // reads the latest persisted content; anything still
                // in the debounce window will be missed on this run.
                try {
                  const { created } = await extractChecklistAsTasks(pageId);
                  if (created === 0) {
                    toast.info("No unchecked boxes found in this note.", {
                      description: "If you just added boxes, wait a second for auto-save and try again.",
                    });
                  } else {
                    toast.success(
                      `Created ${created} task${created === 1 ? "" : "s"} — check /tasks.`,
                      {
                        description: "Tip: delete the checkbox lines here once the tasks are in your list.",
                      },
                    );
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't extract checklist");
                }
              }}
              title="Create tasks from unchecked checkboxes in this note"
            >
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              Extract tasks
            </Button>
          </div>
          <NoteHistoryPanel
            pageId={pageId}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />

          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <BlockEditor
              pageId={pageId}
              initialContent={page.content}
              onChange={handleContentChange}
              editable={true}
            />
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
