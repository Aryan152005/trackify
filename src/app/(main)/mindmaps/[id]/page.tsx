"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  saveMindMapData,
  updateMindMap,
  deleteMindMap,
} from "@/lib/mindmaps/actions";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2, Check, Cloud } from "lucide-react";
import Link from "next/link";
import type { MindMap, MindMapNode, MindMapEdge } from "@/lib/types/mindmap";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";
import { toast } from "sonner";

const MindMapCanvas = dynamic(
  () =>
    import("@/components/mindmaps/mindmap-canvas").then(
      (mod) => mod.MindMapCanvas
    ),
  { ssr: false, loading: () => <MindMapCanvasLoader /> }
);

function MindMapCanvasLoader() {
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

export default function MindMapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mindmapId = params.id as string;

  const [mindmap, setMindmap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "idle"
  >("idle");
  const [deleting, setDeleting] = useState(false);
  const [remoteScene, setRemoteScene] = useState<{ nodes: MindMapNode[]; edges: MindMapEdge[] } | null>(null);

  // Broadcast channel (peer collab)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const selfIdRef = useRef<string>("");
  const lastSceneSigRef = useRef<string>("");

  // Refs for debounced auto-save
  const nodesRef = useRef<MindMapNode[]>([]);
  const edgesRef = useRef<MindMapEdge[]>([]);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Fetch mind map
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function fetchMindMap() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("mindmaps")
        .select("*")
        .eq("id", mindmapId)
        .single();

      if (error || !data) {
        router.push("/mindmaps");
        return;
      }

      const mm = data as MindMap;
      setMindmap(mm);
      setTitle(mm.title);
      nodesRef.current = mm.nodes ?? [];
      edgesRef.current = mm.edges ?? [];
      viewportRef.current = mm.viewport ?? { x: 0, y: 0, zoom: 1 };
      setLoading(false);
    }

    fetchMindMap();
  }, [mindmapId, router]);

  // -----------------------------------------------------------------------
  // Auto-save (debounced 2s)
  // -----------------------------------------------------------------------

  const triggerSave = useCallback(() => {
    setSaveStatus("unsaved");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveMindMapData(
          mindmapId,
          nodesRef.current,
          edgesRef.current,
          viewportRef.current
        );
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("unsaved");
        toast.error(err instanceof Error ? err.message : "Failed to save mind map");
      }
    }, 2000);
  }, [mindmapId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Real-time collab channel — nodes + edges sync across peers. Viewport
  // stays per-user (independent pan/zoom, like Figma).
  useEffect(() => {
    if (!mindmapId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      selfIdRef.current = data.user?.id ?? Math.random().toString(36).slice(2);
    });
    const channel = supabase.channel(`mindmap-scene-${mindmapId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "scene" }, (payload) => {
      const p = payload.payload as { from: string; nodes: MindMapNode[]; edges: MindMapEdge[] };
      if (!p || p.from === selfIdRef.current) return;
      // Update our refs so debounced save has the fresh scene.
      nodesRef.current = p.nodes ?? [];
      edgesRef.current = p.edges ?? [];
      setRemoteScene({ nodes: p.nodes ?? [], edges: p.edges ?? [] });
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [mindmapId]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  // Broadcast the current scene to peers. Keeps a signature check so we don't
  // flood the channel when onNodesChange fires without actual geometry changes.
  const broadcastScene = useCallback(() => {
    if (!channelRef.current) return;
    const sig =
      `${nodesRef.current.length}:${nodesRef.current.map((n) => `${n.id}@${n.position.x.toFixed(0)},${n.position.y.toFixed(0)}`).join("|")}` +
      `::${edgesRef.current.length}:${edgesRef.current.map((e) => `${e.source}-${e.target}`).join("|")}`;
    if (sig === lastSceneSigRef.current) return;
    lastSceneSigRef.current = sig;
    channelRef.current.send({
      type: "broadcast",
      event: "scene",
      payload: { from: selfIdRef.current, nodes: nodesRef.current, edges: edgesRef.current },
    });
  }, []);

  const handleNodesChange = useCallback(
    (nodes: MindMapNode[]) => {
      nodesRef.current = nodes;
      triggerSave();
      broadcastScene();
    },
    [triggerSave, broadcastScene]
  );

  const handleEdgesChange = useCallback(
    (edges: MindMapEdge[]) => {
      edgesRef.current = edges;
      triggerSave();
      broadcastScene();
    },
    [triggerSave, broadcastScene]
  );

  const handleViewportChange = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      viewportRef.current = viewport;
      triggerSave();
    },
    [triggerSave]
  );

  async function handleTitleSave() {
    setEditingTitle(false);
    if (title.trim() && title !== mindmap?.title) {
      try {
        await updateMindMap(mindmapId, { title: title.trim() });
        setMindmap((prev) => (prev ? { ...prev, title: title.trim() } : prev));
      } catch {
        // Revert on error
        setTitle(mindmap?.title ?? "");
      }
    } else {
      setTitle(mindmap?.title ?? "");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this mind map?"))
      return;
    setDeleting(true);
    try {
      await deleteMindMap(mindmapId);
      router.push("/mindmaps");
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

  if (!mindmap) return null;

  return (
    <AnimatedPage>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/mindmaps"
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
                    setTitle(mindmap.title);
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
              title="Delete mind map"
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
          entityType="mindmap"
          entityId={mindmapId}
          entityTitle={title || "Untitled Mind Map"}
          showCursors={true}
        />

        {/* Canvas */}
        <div className="h-[calc(100vh-10rem)]">
          <MindMapCanvas
            initialNodes={mindmap.nodes ?? []}
            initialEdges={mindmap.edges ?? []}
            initialViewport={mindmap.viewport}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onViewportChange={handleViewportChange}
            remoteScene={remoteScene}
          />
        </div>
      </div>
    </AnimatedPage>
  );
}
