import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tokenize, jaccard, sameDay } from "@/lib/smart-mindmap/text-utils";

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
}

export type EdgeKind = "shared-tag" | "keyword" | "same-day" | "mentions";

export interface SmartEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label: string;
  strength: number; // 0..1
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
  // Primary entity the action targets
  taskId?: string;
  reminderId?: string;
  entryId?: string;
  // For "create-*" actions, hints passed to the new-form
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
const MAX_EDGES_PER_NODE = 5;

export async function buildSmartGraph(workspaceId: string | null): Promise<SmartGraph> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { nodes: [], edges: [], suggestions: [] };

  const now = new Date();
  const lookback = new Date(now.getTime() - ENTRY_LOOKBACK_DAYS * 24 * 3600 * 1000);

  // Fetch in parallel. Scope by workspace when available.
  const tasksQuery = supabase
    .from("tasks")
    .select("id, title, description, due_date, due_time, status, priority, updated_at")
    .eq("user_id", user.id)
    .neq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(25);
  const remindersQuery = supabase
    .from("reminders")
    .select("id, title, description, reminder_time, is_completed")
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

  // ── Build nodes
  const nodes: SmartNode[] = [];

  (tasks ?? []).forEach((t) => {
    const due = t.due_date ? new Date(t.due_date as string) : null;
    nodes.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title as string,
      subtitle: t.due_date
        ? `Due ${(t.due_date as string).slice(5)} · ${t.priority ?? "?"}`
        : `No due date · ${t.priority ?? "?"}`,
      due_date: t.due_date as string | null,
      status: t.status as string,
      is_overdue: !!(due && due < now && t.status !== "done"),
    });
  });

  (reminders ?? []).forEach((r) => {
    const when = r.reminder_time ? new Date(r.reminder_time as string) : null;
    nodes.push({
      id: `reminder-${r.id}`,
      kind: "reminder",
      title: r.title as string,
      subtitle: when ? when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
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

  // Cap total nodes (keep diversity: take proportional share from each kind)
  let finalNodes = nodes;
  if (nodes.length > NODE_CAP) {
    const tasksSlice = nodes.filter((n) => n.kind === "task").slice(0, 18);
    const remindersSlice = nodes.filter((n) => n.kind === "reminder").slice(0, 14);
    const entriesSlice = nodes.filter((n) => n.kind === "entry").slice(0, 10);
    const pagesSlice = nodes.filter((n) => n.kind === "page").slice(0, 8);
    finalNodes = [...tasksSlice, ...remindersSlice, ...entriesSlice, ...pagesSlice];
  }

  // Pre-tokenize titles + descriptions
  const tokens = new Map<string, Set<string>>();
  finalNodes.forEach((n) => {
    tokens.set(n.id, tokenize(n.title));
  });
  // Enrich token sets with descriptions / page content text if useful
  (tasks ?? []).forEach((t) => {
    const id = `task-${t.id}`;
    const existing = tokens.get(id);
    if (!existing) return;
    tokenize(t.description as string | null).forEach((w) => existing.add(w));
  });
  (reminders ?? []).forEach((r) => {
    const id = `reminder-${r.id}`;
    const existing = tokens.get(id);
    if (!existing) return;
    tokenize(r.description as string | null).forEach((w) => existing.add(w));
  });
  (entries ?? []).forEach((e) => {
    const id = `entry-${e.id}`;
    const existing = tokens.get(id);
    if (!existing) return;
    tokenize(e.description as string | null).forEach((w) => existing.add(w));
    tokenize(e.work_done as string | null).forEach((w) => existing.add(w));
  });

  // ── Build edges
  const candidateEdges: SmartEdge[] = [];
  for (let i = 0; i < finalNodes.length; i++) {
    for (let j = i + 1; j < finalNodes.length; j++) {
      const a = finalNodes[i];
      const b = finalNodes[j];
      // Skip page-page edges — too noisy
      if (a.kind === "page" && b.kind === "page") continue;

      const ta = tokens.get(a.id)!;
      const tb = tokens.get(b.id)!;

      // Keyword similarity
      const { score, shared } = jaccard(ta, tb);
      if (score >= 0.25 || shared.length >= 2) {
        candidateEdges.push({
          id: `e-${a.id}-${b.id}-kw`,
          source: a.id,
          target: b.id,
          kind: "keyword",
          label: shared.slice(0, 2).join(", "),
          strength: Math.min(1, score * 2),
        });
      }

      // Same-day (task due_date ↔ entry date, or reminder time ↔ entry date)
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
        });
      }
    }
  }

  // Prune: max MAX_EDGES_PER_NODE per node, keep strongest first
  const perNodeCount = new Map<string, number>();
  candidateEdges.sort((a, b) => b.strength - a.strength);
  const edges: SmartEdge[] = [];
  for (const e of candidateEdges) {
    const sCount = perNodeCount.get(e.source) ?? 0;
    const tCount = perNodeCount.get(e.target) ?? 0;
    if (sCount >= MAX_EDGES_PER_NODE || tCount >= MAX_EDGES_PER_NODE) continue;
    perNodeCount.set(e.source, sCount + 1);
    perNodeCount.set(e.target, tCount + 1);
    edges.push(e);
  }

  // ── Build suggestions (max ~8)
  const suggestions: Suggestion[] = [];

  // 1) Overdue reminders → complete or reschedule
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

  // 2) Task without due date + related reminder (keyword edge) → copy reminder time
  const tasksById = new Map((tasks ?? []).map((t) => [`task-${t.id}`, t]));
  const remindersById = new Map((reminders ?? []).map((r) => [`reminder-${r.id}`, r]));
  for (const e of edges) {
    if (e.kind !== "keyword") continue;
    const aIsTask = e.source.startsWith("task-") && e.target.startsWith("reminder-");
    const bIsTask = e.source.startsWith("reminder-") && e.target.startsWith("task-");
    if (!aIsTask && !bIsTask) continue;

    const taskKey = aIsTask ? e.source : e.target;
    const remKey = aIsTask ? e.target : e.source;
    const t = tasksById.get(taskKey);
    const r = remindersById.get(remKey);
    if (!t || !r) continue;
    if (t.due_date) continue; // already has a due date
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

  // 3) Tasks done today without an entry → create entry prefilled
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

  // 4) Tasks with due date but no reminder → offer to create a reminder
  (tasks ?? []).forEach((t) => {
    if (!t.due_date || t.status === "done") return;
    const taskWords = tokenize(t.title as string);
    const hasReminder = (reminders ?? []).some((r) => {
      const rw = tokenize(r.title as string);
      const { shared } = jaccard(taskWords, rw);
      return shared.length >= 2;
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

  // Cap suggestions
  return { nodes: finalNodes, edges, suggestions: suggestions.slice(0, 10) };
}
