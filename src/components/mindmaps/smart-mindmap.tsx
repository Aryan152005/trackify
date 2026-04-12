"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  reminder: () => `/reminders`,
  entry: () => `/entries`,
  page: (id) => `/notes/${id}`,
};

// ─── Custom Node ────────────────────────────────────────────────

function SmartNodeCard({ data }: NodeProps<SmartNode>) {
  const style = KIND_STYLES[data.kind];
  const Icon = style.icon;
  return (
    <div
      className={`group relative min-w-[160px] max-w-[220px] rounded-lg border-2 ${style.border} ${style.bg} px-3 py-2 shadow-sm transition hover:shadow-md`}
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

// ─── Layout: radial cluster by kind ─────────────────────────────

function layoutNodes(nodes: SmartNode[]): Node[] {
  // Group by kind in concentric rings so the user sees clusters at a glance.
  const byKind: Record<EntityKind, SmartNode[]> = { task: [], reminder: [], entry: [], page: [] };
  nodes.forEach((n) => byKind[n.kind].push(n));

  const RING_SPACING = 280;
  const kindOrder: EntityKind[] = ["task", "reminder", "entry", "page"];
  const result: Node[] = [];

  kindOrder.forEach((kind, ringIdx) => {
    const group = byKind[kind];
    if (group.length === 0) return;
    const radius = (ringIdx + 1) * RING_SPACING;
    const step = (2 * Math.PI) / Math.max(group.length, 3);
    const angleOffset = ringIdx * 0.3; // stagger rings so nodes don't line up
    group.forEach((n, i) => {
      const angle = i * step + angleOffset;
      result.push({
        id: n.id,
        type: "smart",
        position: {
          x: Math.cos(angle) * radius + 600,
          y: Math.sin(angle) * radius + 400,
        },
        data: n,
      });
    });
  });

  return result;
}

function mapEdges(edges: SmartGraph["edges"]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: e.kind === "keyword",
    label: e.label,
    labelStyle: { fontSize: 10, fill: "#71717a" },
    labelBgStyle: { fill: "rgba(255,255,255,0.8)" },
    style: {
      stroke: e.kind === "same-day" ? "#f59e0b" : e.kind === "keyword" ? "#6366f1" : "#71717a",
      strokeWidth: 1 + e.strength * 1.5,
      strokeDasharray: e.kind === "same-day" ? "4 4" : undefined,
    },
  }));
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

  const rfNodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const rfEdges = useMemo(() => mapEdges(graph.edges), [graph.edges]);

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
        <div className="h-[600px] w-full">
          <ReactFlowProvider>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              onNodeClick={onNodeClick}
              proOptions={{ hideAttribution: true }}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <MiniMap pannable zoomable className="!bg-zinc-100 dark:!bg-zinc-800" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
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

      {/* Suggestions */}
      <div className="space-y-3">
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
  }
}
function actionIcon(s: Suggestion): React.ComponentType<{ className?: string }> {
  switch (s.kind) {
    case "set-due-from-reminder": return CalendarIcon;
    case "complete-overdue-reminder": return CheckCircle2;
    case "create-reminder-from-task": return Bell;
    case "create-entry-for-task": return Plus;
  }
}
