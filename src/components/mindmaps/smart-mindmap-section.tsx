"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles, RefreshCw, Info } from "lucide-react";
import { SmartMindMap } from "@/components/mindmaps/smart-mindmap";
import type { SmartGraph } from "@/lib/smart-mindmap/graph";

/**
 * Collapsible host for the auto-built smart mindmap at the top of /mindmaps.
 *
 * Design rationale:
 *   - Smart mindmap is the highest-value view most users want to see first
 *     (their own work auto-connected), so it's expanded by default.
 *   - User-created mindmaps are secondary but still primary — they scroll
 *     just below this section.
 *   - Collapse state persists per-browser via localStorage so a power user
 *     who always wants to skip straight to their manual maps can do so.
 *   - The chevron and header stay visible when collapsed; only the graph
 *     canvas (the ~600px-tall heavy bit) unmounts.
 */
interface Props {
  graph: SmartGraph;
  workspaceId: string | null;
}

const STORAGE_KEY = "wis:smart-mindmap:collapsed";

export function SmartMindMapSection({ graph, workspaceId }: Props) {
  // Always start "open" on the server so the SSR HTML matches the initial
  // client render (avoids a flash of the collapsed state). Hydrate the
  // actual preference in an effect.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* ignore — private mode or quota issue */
    }
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const suggestionCount = graph.suggestions.length;

  return (
    <section
      className="overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-zinc-900"
      aria-labelledby="smart-mindmap-heading"
    >
      {/* Header — stays visible even when collapsed so the user can re-open. */}
      <button
        type="button"
        onClick={toggle}
        className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-indigo-100/40 dark:hover:bg-indigo-900/20 sm:px-5"
        aria-expanded={!collapsed}
        aria-controls="smart-mindmap-body"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2
              id="smart-mindmap-heading"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Smart Mindmap
              {nodeCount > 0 && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {nodeCount} node{nodeCount === 1 ? "" : "s"} · {edgeCount} link{edgeCount === 1 ? "" : "s"}
                  {suggestionCount > 0 && ` · ${suggestionCount} suggestion${suggestionCount === 1 ? "" : "s"}`}
                </span>
              )}
            </h2>
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400 sm:line-clamp-none">
              Auto-built from your tasks, reminders, entries, and notes — click a node to open it.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Regenerate — router.refresh forces the server action to re-run. */}
          <span
            title="Regenerate by reloading this page (Ctrl+R)"
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 sm:inline-flex"
          >
            <RefreshCw className="h-3 w-3" />
            Live
          </span>
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-transform group-hover:bg-indigo-100 dark:text-zinc-400 dark:group-hover:bg-indigo-900/30 ${
              collapsed ? "" : "rotate-180"
            }`}
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </button>

      {/* Body — only mount the heavy graph when expanded. */}
      {hydrated && !collapsed && (
        <div id="smart-mindmap-body" className="border-t border-indigo-200/70 px-2 pb-4 pt-3 dark:border-indigo-900/30 sm:px-4">
          {nodeCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <Info className="mb-2 h-6 w-6 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nothing to connect yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                Create a few tasks, reminders, or work entries — the smart mindmap auto-builds from your data.
              </p>
            </div>
          ) : (
            <SmartMindMap graph={graph} workspaceId={workspaceId} />
          )}
        </div>
      )}
    </section>
  );
}
