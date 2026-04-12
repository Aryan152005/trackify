import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { listWorkspaceActivity, getWorkspaceMemberStats } from "@/lib/activity/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Activity, Users, FileText, ClipboardList, Columns3, Pencil, Brain, Target, BookOpen,
  Plus, Edit3, Tag, Trash2, Archive, UserPlus, LogIn,
} from "lucide-react";

const ENTITY_ICON: Record<string, React.ReactNode> = {
  page: <FileText className="h-3.5 w-3.5" />,
  task: <ClipboardList className="h-3.5 w-3.5" />,
  board: <Columns3 className="h-3.5 w-3.5" />,
  drawing: <Pencil className="h-3.5 w-3.5" />,
  mindmap: <Brain className="h-3.5 w-3.5" />,
  challenge: <Target className="h-3.5 w-3.5" />,
  entry: <BookOpen className="h-3.5 w-3.5" />,
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
  challenge: (id) => `/challenges/${id}`,
  entry: (id) => `/entries/${id}`,
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  created: <Plus className="h-3 w-3" />,
  edited: <Edit3 className="h-3 w-3" />,
  renamed: <Tag className="h-3 w-3" />,
  deleted: <Trash2 className="h-3 w-3" />,
  archived: <Archive className="h-3 w-3" />,
  invited: <UserPlus className="h-3 w-3" />,
  joined: <LogIn className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  editor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  viewer: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function WorkspaceActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="No workspace"
          description="You don't have an active workspace yet."
        />
      </div>
    );
  }

  const [activity, members] = await Promise.all([
    listWorkspaceActivity(workspaceId, 100),
    getWorkspaceMemberStats(workspaceId),
  ]);

  const totalActivity30d = members.reduce((sum, m) => sum + m.activity_30d, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Workspace Activity"
        description="See who's in this workspace and what they've been working on."
        backHref="/workspace/members"
        backLabel="Back to Members"
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Members" value={String(members.length)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Activity (30d)" value={String(totalActivity30d)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Events logged" value={String(activity.length)} hint={activity.length >= 100 ? "showing latest 100" : undefined} />
      </div>

      {/* Member overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members & contribution (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>
                      {m.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{m.activity_30d}</p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">events</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No activity logged yet. Edits on pages, boards, challenges, and other items show up here.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => {
                const href = ENTITY_HREF[a.entity_type]?.(a.entity_id);
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      {a.actor_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.actor_avatar} alt={a.actor_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-zinc-500">
                          {a.actor_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-800 dark:text-zinc-200">
                        <span className="font-medium">{a.actor_name}</span>
                        <span className="mx-1 inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {ACTION_ICON[a.action] ?? <Activity className="h-3 w-3" />}
                          {a.action}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          {ENTITY_ICON[a.entity_type] ?? <Activity className="h-3 w-3" />}
                          {a.entity_type}
                        </span>
                        {href ? (
                          <Link href={href} className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            {a.entity_title}
                          </Link>
                        ) : (
                          <span className="ml-1 font-medium">{a.entity_title}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {icon}
          {label}
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pb-3 pt-0"><p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p></CardContent>}
    </Card>
  );
}
