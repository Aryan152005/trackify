"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertTriangle, Calendar as CalendarIcon, Bell, FileText, StickyNote,
  CheckCircle2, Plus, Sparkles, Loader2, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { SmartGraph, SmartNode, EntityKind, Suggestion } from "@/lib/smart-mindmap/graph";
import {
  setTaskDueFromReminder,
  completeReminder,
  createReminderForTask,
  createEntryForTask,
  archiveStaleTask,
  batchCompleteOverdueReminders,
} from "@/lib/smart-mindmap/actions";

// ─── Visual config ──────────────────────────────────────────────

const KIND_STYLES: Record<EntityKind, { bg: string; border: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  task:     { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-400", text: "text-indigo-900 dark:text-indigo-200", icon: CheckCircle2 },
  reminder: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-400", text: "text-amber-900 dark:text-amber-200", icon: Bell },
  entry:    { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-400", text: "text-emerald-900 dark:text-emerald-200", icon: FileText },
  page:     { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-400", text: "text-purple-900 dark:text-purple-200", icon: StickyNote },
};

const KIND_HREF: Record<EntityKind, (rawId: string) => string> = {
  task: (id) => `/tasks/${id}`,
  // Reminders have no detail page — list view highlights the row.
  reminder: () => `/reminders`,
  // Entries DO have a detail page, so deep-link to it.
  entry: (id) => `/entries/${id}`,
  page: (id) => `/notes/${id}`,
};

// ─── Custom Node ────────────────────────────────────────────────

function SmartNodeCard({ data }: NodeProps<SmartNode>) {
  const style = KIND_STYLES[data.kind];
  const Icon = style.icon;
  // Node accent override — set by the parent when a non-default color mode
  // is active. We read the CSS variable off the closest ancestor with it
  // defined (the ReactFlow-wrapped node element).
  // Using CSS var means the tailwind classes stay stable; the var just
  // paints the border when present.
  return (
    <div
      className={`group relative min-w-[160px] max-w-[220px] rounded-lg border-2 ${style.border} ${style.bg} px-3 py-2 shadow-sm transition hover:shadow-md`}
      style={{
        borderColor: "var(--node-accent, undefined)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400" />
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
        <Icon className="h-3 w-3" />
        {data.kind}
        {data.is_overdue && (
          <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
          </span>
        )}
      </div>
      <p className={`mt-1 line-clamp-2 text-xs font-semibold ${style.text}`}>{data.title}</p>
      {data.subtitle && (
        <p className="mt-0.5 truncate text-[10px] text-zinc-500 dark:text-zinc-400">{data.subtitle}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400" />
    </div>
  );
}

const nodeTypes = { smart: SmartNodeCard };

// ─── Layout: ELK.js layered ─────────────────────────────────────
//
// Replaces the old 4-column-by-kind layout. ELK's "layered" algorithm is
// hierarchical Sugiyama — it:
//   - stacks parent-child task edges top-to-bottom,
//   - groups keyword/tag/same-board clusters near each other,
//   - minimises edge crossings (the "phone-book" problem),
//   - leaves enough whitespace that long titles don't overlap.
//
// It runs asynchronously in the browser (pure JS, no server). We seed it
// with sensible defaults so the layout is stable across reloads — only
// structural changes re-shuffle positions.

const NODE_W = 200;
const NODE_H = 72;
const elk = new ELK();

async function layoutWithElk(
  nodes: SmartNode[],
  edges: SmartGraph["edges"],
): Promise<Node[]> {
  if (nodes.length === 0) return [];
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "60",
      "elk.spacing.nodeNode": "40",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_W,
      height: NODE_H,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const laid = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  (laid.children ?? []).forEach((c) => {
    positions.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  });

  return nodes.map((n) => ({
    id: n.id,
    type: "smart",
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: n,
  }));
}

// Edge style per kind — each relationship gets a distinct visual so the graph
// reads like a legend. FK-type edges (parent-child, task-reminder) are bold
// solid lines; inferred edges (keyword, same-day) are thinner and dashier.
const EDGE_STYLE: Record<
  SmartGraph["edges"][number]["kind"],
  { stroke: string; dash?: string; animated: boolean }
> = {
  "parent-child": { stroke: "#0ea5e9", animated: false },
  "task-reminder": { stroke: "#f59e0b", animated: false },
  "same-board": { stroke: "#8b5cf6", animated: false },
  "shared-tag": { stroke: "#10b981", animated: false },
  "keyword": { stroke: "#6366f1", animated: true },
  "same-day": { stroke: "#71717a", dash: "4 4", animated: false },
};

function mapEdges(edges: SmartGraph["edges"]): Edge[] {
  return edges.map((e) => {
    const s = EDGE_STYLE[e.kind];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: s.animated,
      label: e.label,
      labelStyle: { fontSize: 10, fill: "#71717a" },
      labelBgStyle: { fill: "rgba(255,255,255,0.8)" },
      // Surfaced via the native SVG title so browsers show it on hover —
      // cheap "why does this edge exist" tooltip without custom DOM.
      data: { reason: e.reason ?? "" },
      style: {
        stroke: s.stroke,
        strokeWidth: 1 + e.strength * 1.5,
        strokeDasharray: s.dash,
      },
    };
  });
}

// ─── Main component ──────────────────────────────────────────────

interface Props {
  graph: SmartGraph;
  workspaceId: string | null;
}

export function SmartMindMap({ graph, workspaceId }: Props) {
  const router = useRouter();
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Filter toggles
  const [showKinds, setShowKinds] = useState<Record<EntityKind, boolean>>({
    task: true,
    reminder: true,
    entry: true,
    page: true,
  });
  const [showEdgeKinds, setShowEdgeKinds] = useState<
    Record<SmartGraph["edges"][number]["kind"], boolean>
  >({
    "parent-child": true,
    "task-reminder": true,
    "same-board": true,
    "shared-tag": true,
    "keyword": true,
    "same-day": true,
  });

  // Hover state — node id that's currently hovered; neighbors get highlighted, others dim
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Date-window filter — scope visible nodes to a time range. Defaults to
  // "all" so users see the full graph on first paint; they can narrow with
  // one click. "today"/"week"/"month" check any date field on a node
  // (due_date / reminder_time / entry_date); nodes without a date stay in
  // "all" only.
  type DateWindow = "all" | "today" | "week" | "month";
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");

  // Live title search — pure substring match on node titles. Empty string
  // means "no filter" so typing is additive, not destructive.
  const [search, setSearch] = useState("");

  // Recolor-by: default is "kind" (task=indigo, reminder=amber, etc).
  // Switching to another axis reveals a different structure — e.g. "urgency"
  // reddens overdue items, "board" groups tasks on the same kanban.
  type ColorMode = "kind" | "urgency" | "status" | "priority";
  const [colorMode, setColorMode] = useState<ColorMode>("kind");

  // Edge under the pointer — used to show a "why this edge" tooltip with
  // the precomputed reason (see graph.ts). Clean custom tooltip beats the
  // native <title> one which flashes slow and can't be styled.
  const [hoverEdge, setHoverEdge] = useState<{
    reason: string;
    x: number;
    y: number;
  } | null>(null);

  // Pre-compute window bounds once per dateWindow change.
  const windowBounds = useMemo(() => {
    if (dateWindow === "all") return null;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    if (dateWindow === "week") end.setDate(end.getDate() + 6);
    else if (dateWindow === "month") end.setMonth(end.getMonth() + 1);
    return { start, end };
  }, [dateWindow]);

  function nodeInWindow(n: SmartNode): boolean {
    if (!windowBounds) return true;
    const raw = n.due_date ?? n.reminder_time ?? n.entry_date;
    if (!raw) return false; // no date on node → excluded from narrower windows
    const d = new Date(raw);
    return d >= windowBounds.start && d <= windowBounds.end;
  }

  // Filtered view of graph based on ALL active filters (kind, date, search).
  const visibleNodes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return graph.nodes.filter((n) => {
      if (!showKinds[n.kind]) return false;
      if (!nodeInWindow(n)) return false;
      if (needle && !n.title.toLowerCase().includes(needle)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes, showKinds, windowBounds, search]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (e) =>
          visibleNodeIds.has(e.source) &&
          visibleNodeIds.has(e.target) &&
          showEdgeKinds[e.kind]
      ),
    [graph.edges, visibleNodeIds, showEdgeKinds]
  );

  // Neighbour map (source/target both ways) for hover highlights
  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    visibleEdges.forEach((e) => {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    });
    return map;
  }, [visibleEdges]);

  // ELK runs async — compute positions whenever the set of visible nodes or
  // edges changes structurally. Hover highlighting is applied separately on
  // top of the laid-out positions so a hover doesn't trigger a re-layout.
  const [laidNodes, setLaidNodes] = useState<Node[]>([]);
  useEffect(() => {
    let cancelled = false;
    layoutWithElk(visibleNodes, visibleEdges).then((result) => {
      if (!cancelled) setLaidNodes(result);
    });
    return () => { cancelled = true; };
  }, [visibleNodes, visibleEdges]);

  // Colour override per node based on the selected axis. Applied as an
  // inline CSS variable that the SmartNodeCard reads, falling back to the
  // default kind-based style when colorMode === "kind".
  const nodeColorFor = (n: SmartNode): string | null => {
    if (colorMode === "kind") return null;
    if (colorMode === "urgency") {
      if (n.is_overdue) return "#ef4444"; // red
      const d = n.due_date ?? n.reminder_time;
      if (d) {
        const days = (new Date(d).getTime() - Date.now()) / (24 * 3600 * 1000);
        if (days <= 1) return "#f59e0b"; // amber — due within a day
        if (days <= 7) return "#eab308"; // yellow — this week
      }
      return "#71717a"; // zinc — no urgency
    }
    if (colorMode === "status") {
      if (n.status === "done") return "#10b981";
      if (n.status === "in-progress") return "#6366f1";
      if (n.status === "blocked") return "#ef4444";
      return "#a1a1aa";
    }
    if (colorMode === "priority") {
      // Tasks only — non-task nodes get a muted neutral so the mode still
      // reads cleanly when mixed entities are visible.
      const n2 = n as SmartNode & { priority?: string };
      if (n.kind !== "task") return "#a1a1aa";
      if (n2.priority === "high") return "#ef4444";
      if (n2.priority === "medium") return "#f59e0b";
      return "#10b981";
    }
    return null;
  };

  const rfNodes = useMemo(() => {
    const highlighted = hoverId
      ? new Set([hoverId, ...(neighbours.get(hoverId) ?? [])])
      : null;
    return laidNodes.map((n) => {
      const data = n.data as SmartNode;
      const override = nodeColorFor(data);
      const style: React.CSSProperties = {
        transition: "opacity 150ms",
      };
      if (highlighted) {
        style.opacity = highlighted.has(n.id) ? 1 : 0.25;
      }
      // Stamp the CSS variable the node card reads for border + accent.
      if (override) {
        (style as Record<string, string>)["--node-accent"] = override;
      }
      return { ...n, style };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laidNodes, hoverId, neighbours, colorMode]);

  const rfEdges = useMemo(() => {
    const mapped = mapEdges(visibleEdges);
    if (!hoverId) return mapped;
    return mapped.map((e) => {
      const connected = e.source === hoverId || e.target === hoverId;
      return {
        ...e,
        animated: connected ? true : false,
        style: {
          ...(e.style as React.CSSProperties),
          opacity: connected ? 1 : 0.12,
          transition: "opacity 150ms",
        },
      };
    });
  }, [visibleEdges, hoverId]);

  function runAction(sugg: Suggestion, fn: () => Promise<void>) {
    setPendingId(sugg.id);
    setMsg(null);
    startTransition(() => {
      fn()
        .then(() => {
          setActioned((prev) => new Set(prev).add(sugg.id));
          setMsg({ type: "success", text: `✓ ${sugg.title}` });
          router.refresh();
        })
        .catch((err) => {
          setMsg({
            type: "error",
            text: err instanceof Error ? err.message : "Action failed",
          });
        })
        .finally(() => setPendingId(null));
    });
  }

  function onNodeClick(_: unknown, node: Node) {
    const data = node.data as SmartNode;
    const rawId = data.id.split("-").slice(1).join("-"); // strip "task-" prefix etc.
    const href = KIND_HREF[data.kind](rawId);
    router.push(href);
  }

  if (graph.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to show yet</CardTitle>
          <CardDescription>
            Create a few tasks, reminders, or work entries first — the smart mindmap auto-builds from your data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* Canvas */}
      <Card className="overflow-hidden">
        {/* Overview bar — quick health signal at a glance. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 text-[11px] dark:border-zinc-800">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {graph.overview.totals.task} tasks
          </span>
          {graph.overview.overdueTasks > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-2.5 w-2.5" />
              {graph.overview.overdueTasks} overdue
            </span>
          )}
          {graph.overview.dueThisWeek > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              {graph.overview.dueThisWeek} due this week
            </span>
          )}
          {graph.overview.overdueReminders > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {graph.overview.overdueReminders} overdue reminders
            </span>
          )}
          {graph.overview.staleTasks > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {graph.overview.staleTasks} stale
            </span>
          )}

          {/* Color-by selector — pushed to the right. */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">Color by</span>
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as typeof colorMode)}
              className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              aria-label="Recolor nodes by"
            >
              <option value="kind">Kind</option>
              <option value="urgency">Urgency</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
            </select>
          </div>
        </div>

        <div className="relative h-[600px] w-full">
          <ReactFlowProvider>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              onNodeClick={onNodeClick}
              onNodeMouseEnter={(_, n) => setHoverId(n.id)}
              onNodeMouseLeave={() => setHoverId(null)}
              onEdgeMouseEnter={(e, edge) => {
                const reason = (edge.data as { reason?: string } | undefined)?.reason ?? "";
                if (!reason) return;
                setHoverEdge({ reason, x: e.clientX, y: e.clientY });
              }}
              onEdgeMouseMove={(e) => {
                setHoverEdge((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
              }}
              onEdgeMouseLeave={() => setHoverEdge(null)}
              onPaneClick={() => {
                setHoverId(null);
                setHoverEdge(null);
              }}
              proOptions={{ hideAttribution: true }}
              minZoom={0.2}
              maxZoom={2}
              nodesDraggable
              panOnDrag
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <MiniMap pannable zoomable className="!bg-zinc-100 dark:!bg-zinc-800" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Edge hover tooltip — floats near the cursor, shows the
              "why this edge" reason pre-computed in graph.ts. */}
          {hoverEdge && (
            <div
              className="pointer-events-none fixed z-50 max-w-xs rounded-md bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700"
              style={{ left: hoverEdge.x + 12, top: hoverEdge.y + 12 }}
            >
              {hoverEdge.reason}
            </div>
          )}
        </div>
        <div className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <div className="flex flex-wrap items-center gap-3">
            <LegendDot color="bg-indigo-400" label="Tasks" />
            <LegendDot color="bg-amber-400" label="Reminders" />
            <LegendDot color="bg-emerald-400" label="Entries" />
            <LegendDot color="bg-purple-400" label="Notes" />
            <span className="ml-auto">Click any node to open · drag to rearrange</span>
          </div>
        </div>
      </Card>

      {/* Suggestions + Filters */}
      <div className="space-y-3">
        {/* Filter toggles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filter graph</CardTitle>
            <CardDescription className="text-xs">
              Narrow by kind, date, or keyword. Changes apply instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search — live substring match on node titles. */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by title…"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Date window — "today / week / month / all". */}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Date window
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(["today", "week", "month", "all"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setDateWindow(w)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      dateWindow === w
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {w === "today" ? "Today"
                    : w === "week" ? "This week"
                    : w === "month" ? "This month"
                    : "All time"}
                  </button>
                ))}
              </div>
              {dateWindow !== "all" && (
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Hiding nodes without a date. Showing {visibleNodes.length} of {graph.nodes.length}.
                </p>
              )}
            </div>

            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Kinds
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleChip
                active={showKinds.task}
                onClick={() => setShowKinds((s) => ({ ...s, task: !s.task }))}
                color="bg-indigo-500"
                label={`Tasks (${graph.nodes.filter((n) => n.kind === "task").length})`}
              />
              <ToggleChip
                active={showKinds.reminder}
                onClick={() => setShowKinds((s) => ({ ...s, reminder: !s.reminder }))}
                color="bg-amber-500"
                label={`Reminders (${graph.nodes.filter((n) => n.kind === "reminder").length})`}
              />
              <ToggleChip
                active={showKinds.entry}
                onClick={() => setShowKinds((s) => ({ ...s, entry: !s.entry }))}
                color="bg-emerald-500"
                label={`Entries (${graph.nodes.filter((n) => n.kind === "entry").length})`}
              />
              <ToggleChip
                active={showKinds.page}
                onClick={() => setShowKinds((s) => ({ ...s, page: !s.page }))}
                color="bg-purple-500"
                label={`Notes (${graph.nodes.filter((n) => n.kind === "page").length})`}
              />
            </div>
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Connections
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <ToggleChip
                  active={showEdgeKinds["parent-child"]}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, "parent-child": !s["parent-child"] }))}
                  color="bg-sky-500"
                  label="Subtasks"
                />
                <ToggleChip
                  active={showEdgeKinds["task-reminder"]}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, "task-reminder": !s["task-reminder"] }))}
                  color="bg-amber-500"
                  label="Task↔reminder"
                />
                <ToggleChip
                  active={showEdgeKinds["same-board"]}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, "same-board": !s["same-board"] }))}
                  color="bg-purple-500"
                  label="Same board"
                />
                <ToggleChip
                  active={showEdgeKinds["shared-tag"]}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, "shared-tag": !s["shared-tag"] }))}
                  color="bg-emerald-500"
                  label="Shared tag"
                />
                <ToggleChip
                  active={showEdgeKinds.keyword}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, keyword: !s.keyword }))}
                  color="bg-indigo-500"
                  label="Keyword"
                />
                <ToggleChip
                  active={showEdgeKinds["same-day"]}
                  onClick={() => setShowEdgeKinds((s) => ({ ...s, "same-day": !s["same-day"] }))}
                  color="bg-zinc-400"
                  label="Same day"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Smart suggestions
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {graph.suggestions.length}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Auto-link tasks, reminders and entries based on shared keywords and dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {msg && <div className="mb-2"><Alert type={msg.type}>{msg.text}</Alert></div>}
            {graph.suggestions.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                No suggestions right now — your items look tidy.
              </p>
            ) : (
              <ul className="space-y-2">
                {graph.suggestions.map((s) => {
                  const isDone = actioned.has(s.id);
                  const isBusy = pendingId === s.id && pending;
                  return (
                    <li
                      key={s.id}
                      className={`rounded-lg border border-zinc-200 p-2.5 transition dark:border-zinc-800 ${isDone ? "opacity-60" : ""}`}
                    >
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{s.detail}</p>
                      <div className="mt-2">
                        <SuggestionActions
                          suggestion={s}
                          disabled={isBusy || isDone}
                          busy={isBusy}
                          done={isDone}
                          workspaceId={workspaceId}
                          onRun={runAction}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">How this works</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-zinc-400">
            Connections are drawn when items share 2+ keywords or fall on the same date.
            The graph is regenerated every time you open this page — changes made elsewhere show up immediately.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleChip({
  active, onClick, color, label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
        active
          ? "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          : "border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 line-through dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${color} ${active ? "" : "opacity-40"}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function SuggestionActions({
  suggestion, disabled, busy, done, workspaceId, onRun,
}: {
  suggestion: Suggestion;
  disabled: boolean;
  busy: boolean;
  done: boolean;
  workspaceId: string | null;
  onRun: (s: Suggestion, fn: () => Promise<void>) => void;
}) {
  const label = done ? "Done" : busy ? "Working…" : actionLabel(suggestion);
  const Icon = done ? CheckCircle2 : busy ? Loader2 : actionIcon(suggestion);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant={done ? "outline" : "default"}
        disabled={disabled}
        onClick={() => {
          if (done) return;
          onRun(suggestion, async () => {
            switch (suggestion.kind) {
              case "set-due-from-reminder":
                if (suggestion.taskId && suggestion.prefillDate) {
                  await setTaskDueFromReminder(
                    suggestion.taskId,
                    suggestion.prefillDate,
                    suggestion.prefillTime ?? undefined
                  );
                }
                break;
              case "complete-overdue-reminder":
                if (suggestion.reminderId) {
                  await completeReminder(suggestion.reminderId);
                }
                break;
              case "create-reminder-from-task":
                if (suggestion.taskId && suggestion.prefillTitle && suggestion.prefillDate) {
                  await createReminderForTask(
                    suggestion.taskId,
                    suggestion.prefillTitle,
                    suggestion.prefillDate,
                    suggestion.prefillTime ?? "09:00",
                    workspaceId
                  );
                }
                break;
              case "create-entry-for-task":
                if (suggestion.taskId && suggestion.prefillTitle && suggestion.prefillDate) {
                  await createEntryForTask(
                    suggestion.taskId,
                    suggestion.prefillTitle,
                    suggestion.prefillDate,
                    workspaceId
                  );
                }
                break;
              case "archive-stale-task":
                if (suggestion.taskId) {
                  await archiveStaleTask(suggestion.taskId);
                }
                break;
              case "batch-complete-overdue":
                if (suggestion.batchIds && suggestion.batchIds.length > 0) {
                  await batchCompleteOverdueReminders(suggestion.batchIds);
                }
                break;
            }
          });
        }}
      >
        <Icon className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        {label}
      </Button>

      {/* Open in app as fallback navigation */}
      {suggestion.taskId && (
        <a href={`/tasks/${suggestion.taskId}`} className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          <span className="inline-flex items-center gap-0.5">
            <ExternalLink className="h-3 w-3" /> open
          </span>
        </a>
      )}
    </div>
  );
}

function actionLabel(s: Suggestion): string {
  switch (s.kind) {
    case "set-due-from-reminder": return "Set due date";
    case "complete-overdue-reminder": return "Mark complete";
    case "create-reminder-from-task": return "Create reminder";
    case "create-entry-for-task": return "Log entry";
    case "archive-stale-task": return "Archive task";
    case "batch-complete-overdue":
      return s.batchIds ? `Clear ${s.batchIds.length}` : "Clear all";
  }
}
function actionIcon(s: Suggestion): React.ComponentType<{ className?: string }> {
  switch (s.kind) {
    case "set-due-from-reminder": return CalendarIcon;
    case "complete-overdue-reminder": return CheckCircle2;
    case "create-reminder-from-task": return Bell;
    case "create-entry-for-task": return Plus;
    case "archive-stale-task": return AlertTriangle;
    case "batch-complete-overdue": return CheckCircle2;
  }
}
