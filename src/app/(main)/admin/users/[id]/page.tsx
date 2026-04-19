import { requireAdmin, getUserDetail } from "@/lib/admin/actions";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDistanceToNow } from "date-fns";
import { formatIST, formatISTDate } from "@/lib/utils/datetime";
import {
  Activity, AlertCircle, AlertTriangle, Info, Clock, Star, MessageSquare,
  CheckSquare, FileText, StickyNote, Columns3, Bell, AtSign, ClipboardList, Megaphone, Mail,
  Link2,
} from "lucide-react";

export default async function AdminUserDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const user = await getUserDetail(params.id);

  if (!user.profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500">User not found</p>
        <Link href="/admin" className="mt-4 inline-block text-indigo-600 hover:underline">
          Back to Admin
        </Link>
      </div>
    );
  }

  const tasksDone = user.tasks.filter((t) => t.status === "done").length;
  const avgScore = user.entries.length > 0
    ? (user.entries.reduce((s, e) => s + (e.productivity_score ?? 0), 0) / user.entries.length).toFixed(1)
    : "—";
  const totalMinutes = Math.round(
    user.timers.reduce((s, t) => s + ((t.duration_seconds as number) ?? 0), 0) / 60
  );
  const errorLogs = user.logs.filter((l) => l.level === "error").length;
  const warnLogs = user.logs.filter((l) => l.level === "warn").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.profile.name}
        description={`${user.email} · joined ${user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}`}
        backHref="/admin"
        backLabel="Back to Admin"
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard icon={<FileText className="h-4 w-4" />} label="Entries" value={String(user.entries.length)} />
        <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Tasks" value={`${tasksDone}/${user.tasks.length}`} />
        <StatCard icon={<StickyNote className="h-4 w-4" />} label="Pages" value={String(user.pages.length)} />
        <StatCard icon={<Columns3 className="h-4 w-4" />} label="Boards" value={String(user.boards.length)} />
        <StatCard icon={<Bell className="h-4 w-4" />} label="Reminders" value={String(user.reminders.length)} />
        <StatCard
          icon={<Link2 className="h-4 w-4" />}
          label="Shared by them"
          value={String((user.shares ?? []).filter((s) => s.is_active).length)}
        />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Tracked" value={`${totalMinutes}m`} />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Last active"
          value={
            user.lastActivityAt
              ? formatDistanceToNow(new Date(user.lastActivityAt), { addSuffix: true })
              : user.lastSignIn
                ? formatDistanceToNow(new Date(user.lastSignIn), { addSuffix: true }) + " (login)"
                : "Never"
          }
          compact
        />
      </div>

      {/* Auth vs activity detail line */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <b>Last login:</b>{" "}
            {user.lastSignIn ? `${formatIST(user.lastSignIn)} IST` : "Never"}
          </span>
          <span>
            <b>Last activity:</b>{" "}
            {user.lastActivityAt ? `${formatIST(user.lastActivityAt)} IST` : "No heartbeat recorded"}
          </span>
          <span>
            <b>Joined:</b>{" "}
            {user.createdAt ? formatISTDate(user.createdAt) : "—"}
          </span>
        </div>
      </div>

      {/* Health signal */}
      {(errorLogs > 0 || warnLogs > 0) && (
        <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent issues: {errorLogs} error{errorLogs === 1 ? "" : "s"}, {warnLogs} warning{warnLogs === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription className="text-xs">
              Last 50 system events for this user — see full list below.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Activity timeline (system_logs) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity timeline</CardTitle>
          <CardDescription>Last 50 logged events — what this user did, when, and anything that failed.</CardDescription>
        </CardHeader>
        <CardContent>
          {user.logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">No activity recorded yet</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {user.logs.map((log) => {
                const Icon = log.level === "error" ? AlertCircle : log.level === "warn" ? AlertTriangle : Info;
                const tone =
                  log.level === "error" ? "text-red-500"
                  : log.level === "warn" ? "text-amber-500"
                  : "text-indigo-500";
                return (
                  <li key={log.id} className="flex items-start gap-2.5 py-2 text-sm">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {log.service}
                    </span>
                    {log.tag && (
                      <span className="shrink-0 font-mono text-[10px] text-zinc-400">{log.tag}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{log.message}</span>
                    <span className="shrink-0 tabular-nums text-xs text-zinc-400">
                      {formatIST(log.created_at, {
                        month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit", hour12: false,
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Entries with content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work entries ({user.entries.length})</CardTitle>
          <CardDescription>What this user logged. Click to read full body.</CardDescription>
        </CardHeader>
        <CardContent>
          {user.entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-400">No entries yet</p>
          ) : (
            <ul className="space-y-3">
              {user.entries.slice(0, 10).map((e) => (
                <li key={e.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-400">{e.date}</span>
                      {e.productivity_score != null && (
                        <span className="text-amber-500">★ {e.productivity_score}/10</span>
                      )}
                      <StatusPill status={e.status as string} />
                    </div>
                  </div>
                  {e.description && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{e.description}</p>
                  )}
                  {e.work_done && (
                    <p className="mt-1 text-xs text-zinc-500">
                      <span className="font-semibold uppercase tracking-wide">Done:</span> {truncate(e.work_done, 240)}
                    </p>
                  )}
                  {e.learning && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-semibold uppercase tracking-wide">Learned:</span> {truncate(e.learning, 180)}
                    </p>
                  )}
                  {e.mood && (
                    <p className="mt-0.5 text-xs text-zinc-400">Mood: {e.mood}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {user.entries.length > 10 && (
            <p className="mt-3 text-center text-xs text-zinc-400">
              +{user.entries.length - 10} more entries
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tasks with descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks ({user.tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-400">No tasks yet</p>
          ) : (
            <ul className="space-y-2">
              {user.tasks.slice(0, 15).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${t.status === "done" ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 text-sm text-zinc-500">{truncate(t.description, 180)}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      {t.priority} priority
                      {t.due_date && ` · due ${t.due_date}${t.due_time ? ` at ${t.due_time} IST` : ""}`}
                      {t.completed_at && ` · completed ${formatIST(t.completed_at, {
                        month: "short", day: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}`}
                    </p>
                  </div>
                  <StatusPill status={t.status as string} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Feedback submitted */}
      {user.feedback.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-500" />
              Feedback from this user ({user.feedback.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {user.feedback.map((f) => (
                <li key={f.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="font-semibold uppercase tracking-wide">{f.type}</span>
                    <span>{formatISTDate(f.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{f.message}</p>
                  {f.rating != null && (
                    <p className="mt-1 text-xs text-amber-500">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Notifications received by this user */}
      {user.notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-indigo-500" />
              Notifications received ({user.notifications.length})
            </CardTitle>
            <CardDescription>
              What the system alerted this user about · {user.notifications.filter((n) => !n.is_read).length} unread
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {user.notifications.slice(0, 20).map((n) => {
                const TypeIcon =
                  n.type === "mention" ? AtSign
                  : n.type === "assignment" ? ClipboardList
                  : n.type === "reminder" ? Clock
                  : n.type === "request" ? Mail
                  : n.type === "nudge" ? Megaphone
                  : n.type === "comment" ? MessageSquare
                  : Bell;
                return (
                  <li
                    key={n.id}
                    className={`rounded-lg border p-3 ${
                      n.is_read
                        ? "border-zinc-100 dark:border-zinc-800"
                        : "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {n.type}
                          </span>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                          {!n.is_read && (
                            <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                              unread
                            </span>
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                            {truncate(n.body, 240)}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-zinc-400">
                          {formatIST(n.created_at)} IST
                          {n.entity_type && ` · ${n.entity_type}`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {user.notifications.length > 20 && (
              <p className="mt-3 text-center text-xs text-zinc-400">
                +{user.notifications.length - 20} more notifications
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reminders */}
      {user.reminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reminders ({user.reminders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {user.reminders.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${r.is_completed ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {r.title}
                    </p>
                    {r.description && (
                      <p className="mt-0.5 text-sm text-zinc-500">{truncate(r.description, 180)}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      {formatIST(r.reminder_time)} IST
                      {r.is_recurring && ` · repeats ${r.recurrence_pattern ?? "?"}`}
                      {r.notified_at && ` · notified ${formatIST(r.notified_at, {
                        month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit", hour12: true,
                      })}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    r.is_completed
                      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}>
                    {r.is_completed ? "done" : "pending"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Share links created by this user */}
      {user.shares && user.shares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-indigo-500" />
              Share links created ({user.shares.length})
            </CardTitle>
            <CardDescription>
              Every share link this user has generated — active first, revoked below. Useful for
              auditing what they&apos;ve shared externally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {user.shares.slice(0, 15).map((s) => (
                <li
                  key={s.id}
                  className={`flex items-start justify-between gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 ${
                    s.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {s.entity_type}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          s.permission === "edit"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : s.permission === "comment"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                        }`}
                      >
                        {s.permission}
                      </span>
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {s.entity_title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Created {formatIST(s.created_at, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}
                      {s.expires_at && ` · expires ${formatIST(s.expires_at, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                      : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    {s.is_active ? "active" : "revoked"}
                  </span>
                </li>
              ))}
            </ul>
            {user.shares.length > 15 && (
              <p className="mt-3 text-center text-xs text-zinc-400">
                +{user.shares.length - 15} older share links
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content collections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pages ({user.pages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {user.pages.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">No pages yet</p>
            ) : (
              <ul className="space-y-1.5">
                {user.pages.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
                    <span className="truncate">{p.title || "Untitled"}</span>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatIST(p.updated_at, {
                        month: "short", day: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boards ({user.boards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {user.boards.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">No boards yet</p>
            ) : (
              <ul className="space-y-1.5">
                {user.boards.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
                    <span className="truncate">{b.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatIST(b.created_at, {
                        month: "short", day: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-2">
        <Link href={`/admin/logs?user=${encodeURIComponent(user.profile.user_id as string)}`}>
          <Button variant="outline" size="sm">
            <MessageSquare className="mr-2 h-4 w-4" />
            View all logs for this user
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, compact }: { icon: React.ReactNode; label: string; value: string; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className={compact ? "text-sm" : "text-2xl"}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
    : status === "in-progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : status === "blocked" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {status}
    </span>
  );
}

function truncate(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
