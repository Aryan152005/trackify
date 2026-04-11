"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  saveDrawingData,
  updateDrawing,
  deleteDrawing,
} from "@/lib/drawings/actions";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2, Check, Cloud } from "lucide-react";
import Link from "next/link";
import type { Drawing } from "@/lib/types/calendar";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";

const TldrawWrapper = dynamic(
  () =>
    import("@/components/drawings/tldraw-wrapper").then(
      (mod) => mod.TldrawWrapper
    ),
  {
    ssr: false,
    loading: () => <TldrawLoader />,
  }
);

function TldrawLoader() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

export default function DrawingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drawingId = params.id as string;

  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "idle"
  >("idle");
  const [deleting, setDeleting] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Fetch drawing
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function fetchDrawing() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("drawings")
        .select("*")
        .eq("id", drawingId)
        .single();

      if (error || !data) {
        router.push("/drawings");
        return;
      }

      const d = data as Drawing;
      setDrawing(d);
      setTitle(d.title);
      setLoading(false);
    }

    fetchDrawing();
  }, [drawingId, router]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Auto-save handler (called by TldrawWrapper on change, already debounced)
  // -----------------------------------------------------------------------

  const handleDrawingChange = useCallback(
    (data: Record<string, unknown>) => {
      setSaveStatus("unsaved");

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveDrawingData(drawingId, data);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("unsaved");
        }
      }, 500);
    },
    [drawingId]
  );

  // -----------------------------------------------------------------------
  // Title editing
  // -----------------------------------------------------------------------

  async function handleTitleSave() {
    setEditingTitle(false);
    if (title.trim() && title !== drawing?.title) {
      try {
        await updateDrawing(drawingId, { title: title.trim() });
        setDrawing((prev) => (prev ? { ...prev, title: title.trim() } : prev));
      } catch {
        setTitle(drawing?.title ?? "");
      }
    } else {
      setTitle(drawing?.title ?? "");
    }
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this drawing?"))
      return;
    setDeleting(true);
    try {
      await deleteDrawing(drawingId);
      router.push("/drawings");
    } catch {
      setDeleting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!drawing) return null;

  return (
    <AnimatedPage>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/drawings"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") {
                    setTitle(drawing.title);
                    setEditingTitle(false);
                  }
                }}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-2xl font-bold text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                autoFocus
              />
            ) : (
              <h1
                className="cursor-pointer text-2xl font-bold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                onClick={() => setEditingTitle(true)}
                title="Click to edit title"
              >
                {title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Save status */}
            <span className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Saved
                </>
              )}
              {saveStatus === "unsaved" && (
                <>
                  <Cloud className="h-3.5 w-3.5" />
                  Unsaved changes
                </>
              )}
            </span>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="text-zinc-400 hover:text-red-500"
              title="Delete drawing"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <CollaborationToolbar
          entityType="drawing"
          entityId={drawingId}
          entityTitle={title || "Untitled Drawing"}
          showCursors={true}
        />

        {/* Canvas */}
        <TldrawWrapper
          initialData={drawing.data}
          onChange={handleDrawingChange}
        />
      </div>
    </AnimatedPage>
  );
}
