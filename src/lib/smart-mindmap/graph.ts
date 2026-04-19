import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  tokenize,
  computeIdf,
  weightedSimilarity,
  sameDay,
} from "@/lib/smart-mindmap/text-utils";

// ─────────────────────────────────────────────────────────────
// Types exposed to the client
// ─────────────────────────────────────────────────────────────

export type EntityKind = "task" | "reminder" | "entry" | "page";

export interface SmartNode {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle?: string;
  // Metadata used for suggestions and actions
  due_date?: string | null;
  reminder_time?: string | null;
  entry_date?: string | null;
  is_completed?: boolean;
  is_overdue?: boolean;
  status?: string | null;
  /** For tasks: denormalised board name if the task lives on a board. */
  board_name?: string | null;
  /** For tasks: the parent_task_id, if any — used by the layered layout. */
  parent_id?: string | null;
}

export type EdgeKind =
  | "keyword"
  | "same-day"
  | "shared-tag"
  | "parent-child"
  | "same-board"
  | "task-reminder";

export interface SmartEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label: string;
  strength: number; // 0..1
  /** Short human reason the edge exists — shown on hover. */
  reason?: string;
}

export type SuggestionKind =
  | "set-due-from-reminder"
  | "complete-overdue-reminder"
  | "create-reminder-from-task"
  | "create-entry-for-task";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  taskId?: string;
  reminderId?: string;
  entryId?: string;
  prefillTitle?: string;
  prefillDate?: string | null;
  prefillTime?: string | null;
}

export interface SmartGraph {
  nodes: SmartNode[];
  edges: SmartEdge[];
  suggestions: Suggestion[];
}

// ─────────────────────────────────────────────────────────────
// Graph builder
// ─────────────────────────────────────────────────────────────

const NODE_CAP = 50;
const ENTRY_LOOKBACK_DAYS = 14;
const MAX_EDGES_PER_NODE = 6;
// Minimum TF-IDF similarity for a keyword edge. Tuned so that
// items sharing 2 rare tokens easily clear the bar, but items sharing
// only common words do not.
const KEYWORD_MIN_SCORE = 0.12;

export async function buildSmartGraph(workspaceId: string | null): Promise<SmartGraph> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { nodes: [], edges: [], suggestions: [] };

  const now = new Date();
  const lookback = new Date(now.getTime() - ENTRY_LOOKBACK_DAYS * 24 * 3600 * 1000);

  // Fetch in parallel. Scope by workspace when available.
  const tasksQuery = supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, due_time, status, priority, parent_task_id, board_id, column_id, labels, updated_at",
    )
    .eq("user_id", user.id)
    .neq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(25);
  const remindersQuery = supabase
    .from("reminders")
    .select("id, title, description, reminder_time, is_completed, entity_type, entity_id")
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .order("reminder_time", { ascending: true })
    .limit(20);
  const entriesQuery = supabase
    .from("work_entries")
    .select("id, title, description, work_done, date, status")
    .eq("user_id", user.id)
    .gte("date", lookback.toISOString().slice(0, 10))
    .order("date", { ascending: false })
    .limit(15);
  const pagesQuery = workspaceId
    ? supabase
        .from("pages")
        .select("id, title, content, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [] as { id: string; title: string; content: unknown; updated_at: string }[] });

  const [
    { data: tasks },
    { data: reminders },
    { data: entries },
    pagesResult,
  ] = await Promise.all([
    workspaceId ? tasksQuery.eq("workspace_id", workspaceId) : tasksQuery,
    workspaceId ? remindersQuery.eq("workspace_id", workspaceId) : remindersQuery,
    workspaceId ? entriesQuery.eq("workspace_id", workspaceId) : entriesQuery,
    pagesQuery,
  ]);
  const pages = (pagesResult as { data: { id: string; title: string; content: unknown; updated_at: string }[] | null }).data ?? [];

  // Collateral: board names (for subtitle enrichment) and entry tags (for shared-tag edges).
  const boardIds = Array.from(new Set((tasks ?? []).map((t) => t.board_id as string | null).filter(Boolean))) as string[];
  const entryIds = (entries ?? []).map((e) => e.id as string);
  const [boardsResult, entryTagsResult] = await Promise.all([
    boardIds.length > 0
      ? supabase.from("boards").select("id, name").in("id", boardIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    entryIds.length > 0
      ? supabase.from("entry_tags").select("entry_id, tag_id").in("entry_id", entryIds)
      : Promise.resolve({ data: [] as { entry_id: string; tag_id: string }[] }),
  ]);
  const boards = ((boardsResult as { data: { id: string; name: string }[] | null }).data) ?? [];
  const entryTagRows = ((entryTagsResult as { data: { entry_id: string; tag_id: string }[] | null }).data) ?? [];
  const boardNameById = new Map(boards.map((b) => [b.id, b.name]));

  // Build nodes ───────────────────────────────────────────────
  const nodes: SmartNode[] = [];

  (tasks ?? []).forEach((t) => {
    const due = t.due_date ? new Date(t.due_date as string) : null;
    const boardName = t.board_id ? boardNameById.get(t.board_id as string) ?? null : null;
    nodes.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title as string,
      subtitle: t.due_date
        ? `Due ${(t.due_date as string).slice(5)} · ${t.priority ?? "?"}${boardName ? ` · ${boardName}` : ""}`
        : `No due date · ${t.priority ?? "?"}${boardName ? ` · ${boardName}` : ""}`,
      due_date: t.due_date as string | null,
      status: t.status as string,
      is_overdue: !!(due && due < now && t.status !== "done"),
      board_name: boardName,
      parent_id: (t.parent_task_id as string | null) ?? null,
    });
  });

  (reminders ?? []).forEach((r) => {
    const when = r.reminder_time ? new Date(r.reminder_time as string) : null;
    nodes.push({
      id: `reminder-${r.id}`,
      kind: "reminder",
      title: r.title as string,
      subtitle: when
        ? when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "",
      reminder_time: r.reminder_time as string | null,
      is_completed: !!r.is_completed,
      is_overdue: !!(when && when < now && !r.is_completed),
    });
  });

  (entries ?? []).forEach((e) => {
    nodes.push({
      id: `entry-${e.id}`,
      kind: "entry",
      title: e.title as string,
      subtitle: `${e.date} · ${e.status}`,
      entry_date: e.date as string,
      status: e.status as string,
    });
  });

  pages.forEach((p) => {
    nodes.push({
      id: `page-${p.id}`,
      kind: "page",
      title: (p.title as string) || "Untitled",
      subtitle: "Page",
    });
  });

  // Cap total nodes (keep diversity — proportional share per kind)
  let finalNodes = nodes;
  if (nodes.length > NODE_CAP) {
    const tasksSlice = nodes.filter((n) => n.kind === "task").slice(0, 18);
    const remindersSlice = nodes.filter((n) => n.kind === "reminder").slice(0, 14);
    const entriesSlice = nodes.filter((n) => n.kind === "entry").slice(0, 10);
    const pagesSlice = nodes.filter((n) => n.kind === "page").slice(0, 8);
    finalNodes = [...tasksSlice, ...remindersSlice, ...entriesSlice, ...pagesSlice];
  }

  const keepIds = new Set(finalNodes.map((n) => n.id));

  // ── Tokens (titles + descriptions) ─────────────────────────
  const tokens = new Map<string, Set<string>>();
  finalNodes.forEach((n) => tokens.set(n.id, tokenize(n.title)));
  (tasks ?? []).forEach((t) => {
    const id = `task-${t.id}`;
    const ts = tokens.get(id);
    if (!ts) return;
    tokenize(t.description as string | null).forEach((w) => ts.add(w));
  });
  (reminders ?? []).forEach((r) => {
    const id = `reminder-${r.id}`;
    const ts = tokens.get(id);
    if (!ts) return;
    tokenize(r.description as string | null).forEach((w) => ts.add(w));
  });
  (entries ?? []).forEach((e) => {
    const id = `entry-${e.id}`;
    const ts = tokens.get(id);
    if (!ts) return;
    tokenize(e.description as string | null).forEach((w) => ts.add(w));
    tokenize(e.work_done as string | null).forEach((w) => ts.add(w));
  });

  // TF-IDF weights over THIS user's corpus. Common words (meeting, todo) get
  // crushed; rare ones (kubernetes, RLS) dominate — exactly what we want.
  const idf = computeIdf(tokens);

  // ── Build edges ────────────────────────────────────────────
  const candidateEdges: SmartEdge[] = [];

  // FK edges first — these are deterministic facts, never false positives.
  //
  // 1. Parent-child task hierarchy.
  (tasks ?? []).forEach((t) => {
    const childId = `task-${t.id}`;
    const parentRaw = t.parent_task_id as string | null;
    if (!parentRaw) return;
    const parentId = `task-${parentRaw}`;
    if (!keepIds.has(childId) || !keepIds.has(parentId)) return;
    candidateEdges.push({
      id: `e-${parentId}-${childId}-parent`,
      source: parentId,
      target: childId,
      kind: "parent-child",
      label: "subtask",
      strength: 1,
      reason: "Parent task → subtask",
    });
  });

  // 2. Same-board (and ideally same-column) grouping. A pair of tasks on the
  //    same board are likely related; stronger if they share a column too.
  const tasksByBoard = new Map<string, Array<{ id: string; columnId: string | null }>>();
  (tasks ?? []).forEach((t) => {
    if (!t.board_id) return;
    const list = tasksByBoard.get(t.board_id as string) ?? [];
    list.push({ id: `task-${t.id}`, columnId: (t.column_id as string | null) ?? null });
    tasksByBoard.set(t.board_id as string, list);
  });
  tasksByBoard.forEach((items, boardId) => {
    const boardName = boardNameById.get(boardId) ?? "board";
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (!keepIds.has(a.id) || !keepIds.has(b.id)) continue;
        const sameCol = a.columnId && a.columnId === b.columnId;
        candidateEdges.push({
          id: `e-${a.id}-${b.id}-board`,
          source: a.id,
          target: b.id,
          kind: "same-board",
          label: sameCol ? "same column" : boardName,
          strength: sameCol ? 0.9 : 0.7,
          reason: sameCol
            ? `Both in column of board "${boardName}"`
            : `Both on board "${boardName}"`,
        });
      }
    }
  });

  // 3. Reminder explicitly linked to a task (via entity_type/entity_id) —
  //    this is the "Set reminder on task" button's output. Hard-edge it.
  (reminders ?? []).forEach((r) => {
    const remId = `reminder-${r.id}`;
    if (r.entity_type === "task" && r.entity_id) {
      const taskId = `task-${r.entity_id}`;
      if (keepIds.has(remId) && keepIds.has(taskId)) {
        candidateEdges.push({
          id: `e-${taskId}-${remId}-link`,
          source: taskId,
          target: remId,
          kind: "task-reminder",
          label: "reminder for",
          strength: 1,
          reason: "Reminder explicitly linked to task",
        });
      }
    }
  });

  // 4. Shared-tag edges for entries. entry_tags is a join table; two entries
  //    that share even one tag are topically linked (tags are already curated).
  const tagsByEntry = new Map<string, Set<string>>();
  entryTagRows.forEach((row) => {
    const set = tagsByEntry.get(row.entry_id) ?? new Set<string>();
    set.add(row.tag_id);
    tagsByEntry.set(row.entry_id, set);
  });
  const entryNodeIds = Array.from(tagsByEntry.keys()).map((eid) => `entry-${eid}`);
  for (let i = 0; i < entryNodeIds.length; i++) {
    for (let j = i + 1; j < entryNodeIds.length; j++) {
      const aId = entryNodeIds[i];
      const bId = entryNodeIds[j];
      if (!keepIds.has(aId) || !keepIds.has(bId)) continue;
      const aTags = tagsByEntry.get(aId.replace(/^entry-/, "")) ?? new Set<string>();
      const bTags = tagsByEntry.get(bId.replace(/^entry-/, "")) ?? new Set<string>();
      const shared: string[] = [];
      aTags.forEach((t) => { if (bTags.has(t)) shared.push(t); });
      if (shared.length === 0) continue;
      candidateEdges.push({
        id: `e-${aId}-${bId}-tag`,
        source: aId,
        target: bId,
        kind: "shared-tag",
        label: `${shared.length} tag${shared.length === 1 ? "" : "s"}`,
        strength: Math.min(1, 0.5 + shared.length * 0.2),
        reason: `${shared.length} shared tag${shared.length === 1 ? "" : "s"}`,
      });
    }
  }

  // 5. Keyword edges via TF-IDF, PLUS same-day cross-kind edges.
  for (let i = 0; i < finalNodes.length; i++) {
    for (let j = i + 1; j < finalNodes.length; j++) {
      const a = finalNodes[i];
      const b = finalNodes[j];
      if (a.kind === "page" && b.kind === "page") continue; // skip page-page noise

      const ta = tokens.get(a.id)!;
      const tb = tokens.get(b.id)!;

      const { score, shared } = weightedSimilarity(ta, tb, idf);
      if (score >= KEYWORD_MIN_SCORE && shared.length >= 2) {
        candidateEdges.push({
          id: `e-${a.id}-${b.id}-kw`,
          source: a.id,
          target: b.id,
          kind: "keyword",
          label: shared.slice(0, 2).join(", "),
          strength: Math.min(1, score * 3),
          reason: `Shared keywords: ${shared.slice(0, 3).join(", ")} (score ${score.toFixed(2)})`,
        });
      }

      const aDate = a.due_date ?? a.reminder_time ?? a.entry_date;
      const bDate = b.due_date ?? b.reminder_time ?? b.entry_date;
      if (aDate && bDate && sameDay(aDate, bDate) && a.kind !== b.kind) {
        candidateEdges.push({
          id: `e-${a.id}-${b.id}-day`,
          source: a.id,
          target: b.id,
          kind: "same-day",
          label: "same day",
          strength: 0.6,
          reason: "Scheduled on the same calendar date",
        });
      }
    }
  }

  // Deduplicate: if both a FK edge and a keyword edge exist between the same
  // pair, keep the FK one (it's stronger evidence).
  const seenPair = new Map<string, SmartEdge>();
  // Sort so FK-kind edges come first (they win the dedupe).
  const kindWeight: Record<EdgeKind, number> = {
    "parent-child": 0,
    "task-reminder": 1,
    "same-board": 2,
    "shared-tag": 3,
    "keyword": 4,
    "same-day": 5,
  };
  candidateEdges.sort((a, b) => kindWeight[a.kind] - kindWeight[b.kind]);
  for (const e of candidateEdges) {
    const key = [e.source, e.target].sort().join("::");
    if (!seenPair.has(key)) seenPair.set(key, e);
  }
  const dedupedEdges = Array.from(seenPair.values());

  // Prune: max MAX_EDGES_PER_NODE per node, keep strongest first
  const perNodeCount = new Map<string, number>();
  dedupedEdges.sort((a, b) => b.strength - a.strength);
  const edges: SmartEdge[] = [];
  for (const e of dedupedEdges) {
    const sCount = perNodeCount.get(e.source) ?? 0;
    const tCount = perNodeCount.get(e.target) ?? 0;
    if (sCount >= MAX_EDGES_PER_NODE || tCount >= MAX_EDGES_PER_NODE) continue;
    perNodeCount.set(e.source, sCount + 1);
    perNodeCount.set(e.target, tCount + 1);
    edges.push(e);
  }

  // ── Suggestions (unchanged heuristics, kept for compatibility) ─────────
  const suggestions: Suggestion[] = [];

  (reminders ?? []).forEach((r) => {
    const when = r.reminder_time ? new Date(r.reminder_time as string) : null;
    if (when && when < now && !r.is_completed) {
      suggestions.push({
        id: `sugg-complete-${r.id}`,
        kind: "complete-overdue-reminder",
        title: `Overdue reminder: ${r.title}`,
        detail: `Was due ${when.toLocaleString()}. Mark complete?`,
        reminderId: r.id as string,
      });
    }
  });

  const tasksById = new Map((tasks ?? []).map((t) => [`task-${t.id}`, t]));
  const remindersById = new Map((reminders ?? []).map((r) => [`reminder-${r.id}`, r]));
  for (const e of edges) {
    if (e.kind !== "keyword" && e.kind !== "task-reminder") continue;
    const aIsTask = e.source.startsWith("task-") && e.target.startsWith("reminder-");
    const bIsTask = e.source.startsWith("reminder-") && e.target.startsWith("task-");
    if (!aIsTask && !bIsTask) continue;

    const taskKey = aIsTask ? e.source : e.target;
    const remKey = aIsTask ? e.target : e.source;
    const t = tasksById.get(taskKey);
    const r = remindersById.get(remKey);
    if (!t || !r) continue;
    if (t.due_date) continue;
    if (!r.reminder_time) continue;

    const rt = new Date(r.reminder_time as string);
    suggestions.push({
      id: `sugg-duefrom-${t.id}-${r.id}`,
      kind: "set-due-from-reminder",
      title: `Set due date on "${t.title}"`,
      detail: `Related reminder "${r.title}" is scheduled ${rt.toLocaleString()}. Copy as due date?`,
      taskId: t.id as string,
      reminderId: r.id as string,
      prefillDate: rt.toISOString().slice(0, 10),
      prefillTime: rt.toISOString().slice(11, 16),
    });
  }

  const today = now.toISOString().slice(0, 10);
  const entryDatesTitles = new Set(
    (entries ?? []).map((e) => `${(e.date as string).slice(0, 10)}::${(e.title as string).toLowerCase()}`)
  );
  (tasks ?? []).forEach((t) => {
    if (t.status !== "in-progress" && t.status !== "done") return;
    const key = `${today}::${(t.title as string).toLowerCase()}`;
    if (entryDatesTitles.has(key)) return;
    suggestions.push({
      id: `sugg-createentry-${t.id}`,
      kind: "create-entry-for-task",
      title: `Log today's work on "${t.title}"`,
      detail: `Create a work entry for this task.`,
      taskId: t.id as string,
      prefillTitle: t.title as string,
      prefillDate: today,
    });
  });

  (tasks ?? []).forEach((t) => {
    if (!t.due_date || t.status === "done") return;
    const taskWords = tokenize(t.title as string);
    const hasReminder = (reminders ?? []).some((r) => {
      const rw = tokenize(r.title as string);
      const sim = weightedSimilarity(taskWords, rw, idf);
      return sim.shared.length >= 2;
    });
    if (hasReminder) return;
    suggestions.push({
      id: `sugg-createrem-${t.id}`,
      kind: "create-reminder-from-task",
      title: `Set a reminder for "${t.title}"`,
      detail: `Due ${t.due_date}. Create a reminder at that time?`,
      taskId: t.id as string,
      prefillTitle: t.title as string,
      prefillDate: t.due_date as string,
      prefillTime: (t.due_time as string | null) ?? "09:00",
    });
  });

  return { nodes: finalNodes, edges, suggestions: suggestions.slice(0, 10) };
}
