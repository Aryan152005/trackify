import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Welcome content for a brand-new personal workspace.
 *
 * The "blank canvas" problem: new signups land on /today with zero
 * tasks, zero notes, zero boards. They stare at the skeleton of the
 * app with no idea what goes where. Pre-seeding gives them real rows
 * to poke, complete, delete, rename — and the sample label ("sample")
 * makes bulk-clearing trivial once they're ready.
 *
 * Idempotent: if ANY task with the sample label already exists in the
 * workspace, we don't re-seed. This matters because createPersonalWorkspace
 * is itself idempotent (returns existing if found) and we don't want to
 * double-stuff someone's workspace if a retry happens.
 */
export async function seedWelcomeContent(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();

  // Idempotency gate — if there's any sample-tagged task, bail.
  const { data: existing } = await admin
    .from("tasks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .contains("labels", [{ name: "sample" }])
    .limit(1);
  if (existing && existing.length > 0) return;

  const SAMPLE_LABEL = [{ name: "sample", color: "#a1a1aa" }];
  const todayIso = new Date().toISOString().slice(0, 10);

  // ── Tasks — three of varying shape so the list has depth ──
  await admin.from("tasks").insert([
    {
      user_id: userId,
      workspace_id: workspaceId,
      title: "👋 Check off this task",
      description:
        "Tap the circle on the left to mark it done — that's the core loop. You can delete or rename anything tagged 'sample' once you've seen how it works.",
      status: "pending",
      priority: "medium",
      labels: SAMPLE_LABEL,
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      title: "Try the /today page — pick 3 things for the day",
      description:
        "The daily ritual. Tap 'Plan today' and pick 3–5 items from the drawer. Everything else can wait.",
      status: "pending",
      priority: "high",
      due_date: todayIso,
      labels: SAMPLE_LABEL,
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      title: "Capture a thought with the + button (or press C)",
      description:
        "Type 'call mom 6pm' and watch the tokens highlight. Press Enter and a reminder appears on /today.",
      status: "pending",
      priority: "low",
      estimate_minutes: 15,
      labels: SAMPLE_LABEL,
    },
  ]);

  // ── Board — a 3-column Kanban ──
  const { data: board } = await admin
    .from("boards")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: "My first board",
      description:
        "A Kanban for anything — projects, habits, side quests. Drag cards between columns. Right-click a column to rename or change its colour.",
    })
    .select("id")
    .single();

  if (board?.id) {
    await admin.from("board_columns").insert([
      { board_id: board.id, name: "Todo", position: 0, color: "#6366f1" },
      { board_id: board.id, name: "Doing", position: 1, color: "#f59e0b" },
      { board_id: board.id, name: "Done", position: 2, color: "#10b981" },
    ]);
  }

  // ── Note — a BlockNote welcome doc ──
  // BlockNote serialises content as a JSON array of blocks. Keep this
  // shape minimal so schema drift in BlockNote doesn't break seeding —
  // each block has a uniq id, a type, a content array, and a children
  // array. BlockNote hydrates missing fields (props, etc.) on load.
  const uid = () => crypto.randomUUID();
  const welcomeBlocks = [
    {
      id: uid(),
      type: "heading",
      props: { level: 1, textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "Welcome to Trackify 👋", styles: {} }],
      children: [],
    },
    {
      id: uid(),
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [
        { type: "text", text: "This is a note — press ", styles: {} },
        { type: "text", text: "/", styles: { code: true } },
        { type: "text", text: " anywhere in the editor to insert a block (heading, checklist, image, and more). Press ", styles: {} },
        { type: "text", text: "⌘K", styles: { code: true } },
        { type: "text", text: " to jump anywhere in the app.", styles: {} },
      ],
      children: [],
    },
    {
      id: uid(),
      type: "heading",
      props: { level: 2, textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "Three rituals worth trying", styles: {} }],
      children: [],
    },
    {
      id: uid(),
      type: "bulletListItem",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [
        { type: "text", text: "Morning — open ", styles: {} },
        { type: "text", text: "/today", styles: { code: true } },
        { type: "text", text: " and pick 3 things for the day. That's your plan.", styles: {} },
      ],
      children: [],
    },
    {
      id: uid(),
      type: "bulletListItem",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [
        { type: "text", text: "During the day — capture thoughts with ", styles: {} },
        { type: "text", text: "C", styles: { code: true } },
        { type: "text", text: " or the floating +. Don't sort, just dump.", styles: {} },
      ],
      children: [],
    },
    {
      id: uid(),
      type: "bulletListItem",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [
        { type: "text", text: "Friday afternoon — a 3-minute review modal appears asking what shipped and what slipped.", styles: {} },
      ],
      children: [],
    },
    {
      id: uid(),
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [
        { type: "text", text: "All the 'sample' items can be bulk-deleted once you're comfortable — search ", styles: {} },
        { type: "text", text: "sample", styles: { code: true } },
        { type: "text", text: " in /tasks and /notes.", styles: {} },
      ],
      children: [],
    },
  ];

  await admin.from("pages").insert({
    workspace_id: workspaceId,
    created_by: userId,
    title: "Welcome — read me first",
    icon: "👋",
    content: welcomeBlocks,
  });
}
