"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";

/**
 * Inbox — the single pile of things actually needing the viewer's
 * action. Separate from /notifications (which shows events that
 * happened) and from /today (which shows what's scheduled). This is
 * specifically "what's waiting on ME right now".
 *
 * Aggregated sections, in priority order:
 *   1. mentions      — unread @-mention notifications
 *   2. assigned      — open tasks assigned_to = me
 *   3. overdue       — my reminders past due, not completed
 *   4. invites       — pending workspace_invitations for my email
 *   5. requests      — pending requests to_user_id = me
 *
 * Everything returns ids + minimum display text so the page can render
 * without additional fetches. Counts are computed here too so the
 * PageHeader can show "N waiting" without a second round-trip.
 */

export interface InboxMention {
  id: string; // notifications.id
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface InboxAssignedTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  due_date: string | null;
  status: string;
}

export interface InboxOverdueReminder {
  id: string;
  title: string;
  reminder_time: string;
}

export interface InboxInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  inviter_email: string | null;
  role: string;
  token: string;
}

export interface InboxRequest {
  id: string;
  title: string;
  description: string | null;
  type: string;
  from_name: string;
  created_at: string;
  due_date: string | null;
}

export interface InboxSnapshot {
  mentions: InboxMention[];
  assigned: InboxAssignedTask[];
  overdue: InboxOverdueReminder[];
  invites: InboxInvite[];
  requests: InboxRequest[];
  total: number;
}

export async function getInbox(): Promise<InboxSnapshot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const userEmail = user.email?.toLowerCase() ?? "";
  const workspaceId = await getActiveWorkspaceId();
  const nowIso = new Date().toISOString();

  // 1. Unread mentions (any workspace). RLS restricts to user_id = me.
  const mentionsQ = supabase
    .from("notifications")
    .select("id, title, body, entity_type, entity_id, created_at")
    .eq("user_id", user.id)
    .eq("type", "mention")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);

  // 2. Open tasks assigned to me (workspace-scoped via RLS + active WS).
  // Note: assigned_to is a separate column from user_id (owner). Pulling
  // anything assigned to me regardless of who created it.
  let assignedQ = supabase
    .from("tasks")
    .select("id, title, priority, due_date, status")
    .eq("assigned_to", user.id)
    .not("status", "in", "(done,cancelled)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .limit(20);
  if (workspaceId) assignedQ = assignedQ.eq("workspace_id", workspaceId);

  // 3. Overdue reminders (strictly mine — reminders are per-user).
  let overdueQ = supabase
    .from("reminders")
    .select("id, title, reminder_time")
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .lt("reminder_time", nowIso)
    .order("reminder_time", { ascending: true })
    .limit(20);
  if (workspaceId) overdueQ = overdueQ.eq("workspace_id", workspaceId);

  // 4. Pending workspace invitations for my email. Uses admin client
  // because invitations are NOT workspace-scoped to the invitee (they
  // haven't joined yet) so user-client RLS hides them.
  const admin = createAdminClient();
  const invitesP = userEmail
    ? admin
        .from("workspace_invitations")
        .select("id, workspace_id, role, token, expires_at, accepted_at, invited_by")
        .eq("email", userEmail)
        .is("accepted_at", null)
        .gt("expires_at", nowIso)
    : Promise.resolve({ data: [] });

  // 5. Pending requests for me.
  let requestsQ = supabase
    .from("requests")
    .select("id, title, description, type, created_at, due_date, from_user_id")
    .eq("to_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  if (workspaceId) requestsQ = requestsQ.eq("workspace_id", workspaceId);

  const [
    { data: mentions },
    { data: assigned },
    { data: overdue },
    invitesRes,
    { data: requests },
  ] = await Promise.all([mentionsQ, assignedQ, overdueQ, invitesP, requestsQ]);

  // Hydrate invites with workspace name + inviter email (one admin round-trip each).
  const inviteRows = (invitesRes.data ?? []) as Array<{
    id: string;
    workspace_id: string;
    role: string;
    token: string;
    invited_by: string | null;
  }>;
  let invites: InboxInvite[] = [];
  if (inviteRows.length > 0) {
    const wsIds = Array.from(new Set(inviteRows.map((r) => r.workspace_id)));
    const inviterIds = Array.from(
      new Set(inviteRows.map((r) => r.invited_by).filter((x): x is string => !!x)),
    );
    const { data: wsRows } = await admin
      .from("workspaces")
      .select("id, name")
      .in("id", wsIds);
    const nameByWs = new Map<string, string>(
      (wsRows ?? []).map((w) => [w.id as string, (w.name as string) ?? "Workspace"]),
    );
    const emailByUser = new Map<string, string>();
    if (inviterIds.length > 0) {
      const { data: authData } = await admin.auth.admin.listUsers();
      (authData?.users ?? []).forEach((u) => {
        if (u.id && inviterIds.includes(u.id)) {
          emailByUser.set(u.id, u.email ?? "");
        }
      });
    }
    invites = inviteRows.map((r) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      workspace_name: nameByWs.get(r.workspace_id) ?? "Workspace",
      inviter_email: r.invited_by ? emailByUser.get(r.invited_by) ?? null : null,
      role: r.role,
      token: r.token,
    }));
  }

  // Hydrate requests with from-user name (single batch).
  const requestRows = (requests ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    type: string;
    created_at: string;
    due_date: string | null;
    from_user_id: string;
  }>;
  const reqUids = Array.from(new Set(requestRows.map((r) => r.from_user_id)));
  const nameByUser = new Map<string, string>();
  if (reqUids.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", reqUids);
    (profiles ?? []).forEach((p) =>
      nameByUser.set(p.user_id as string, (p.name as string) ?? "Member"),
    );
  }
  const requestsHydrated: InboxRequest[] = requestRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    from_name: nameByUser.get(r.from_user_id) ?? "Teammate",
    created_at: r.created_at,
    due_date: r.due_date,
  }));

  const mentionsList = (mentions ?? []) as InboxMention[];
  const assignedList = (assigned ?? []) as InboxAssignedTask[];
  const overdueList = (overdue ?? []) as InboxOverdueReminder[];
  const total =
    mentionsList.length +
    assignedList.length +
    overdueList.length +
    invites.length +
    requestsHydrated.length;

  return {
    mentions: mentionsList,
    assigned: assignedList,
    overdue: overdueList,
    invites,
    requests: requestsHydrated,
    total,
  };
}
