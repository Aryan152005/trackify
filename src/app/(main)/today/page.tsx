import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTodaySnapshot } from "@/lib/today/actions";
import { getHydratedTodayPlan } from "@/lib/today/plan-actions";
import { PlanTodaySection } from "@/components/today/plan-today-section";
import { WeeklyReviewModal } from "@/components/today/weekly-review-modal";
import { formatIST, formatISTTime, istDateKey } from "@/lib/utils/datetime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { QuickCapture } from "@/components/today/quick-capture";
import { TaskRow } from "@/components/tasks/task-row";
import {
  AlertTriangle, Bell, CheckCircle2, FileText, Lock, Sparkles,
  Flame, Clock, CalendarDays, Quote, ArrowRight, Check, MapPin,
} from "lucide-react";
import type { Task } from "@/lib/types/database";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const [snap, hydratedPlan] = await Promise.all([
    getTodaySnapshot(),
    getHydratedTodayPlan().catch(() => ({ plan: null, tasks: [] })),
  ]);
  const todayKey = istDateKey(new Date());
  const greeting = getGreeting();

  const mappedFocusTask = (t: typeof snap.focusTasks[number]): Task => ({
    id: t.id,
    title: t.title,
    description: null,
    priority: (t.priority as Task["priority"]) ?? "medium",
    status: (t.status as Task["status"]) ?? "pending",
    due_date: t.due_date,
    due_time: t.due_time,
    user_id: user.id,
    workspace_id: null,
    board_id: null,
    column_id: null,
    position: 0,
    assigned_to: null,
    parent_task_id: null,
    labels: [],
    estimate_minutes: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return (
    <>
      {/* Friday-afternoon review prompt — decides for itself whether to
          show (window + not-already-done + not-skipped-recently). */}
      <WeeklyReviewModal />
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`${greeting}, ${profile.name}`}
        description={`Here's what matters today · ${new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} IST`}
      />

      {/* ── Stats strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          label="Streak"
          value={`${snap.stats.streak}d`}
          sub={snap.stats.streak > 0 ? "Keep it going" : "Log one entry"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Done today"
          value={snap.stats.tasksDoneToday}
          sub={snap.stats.tasksDoneToday > 0 ? "Shipped" : "Nothing yet"}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4 text-indigo-500" />}
          label="Week score"
          value={snap.stats.weekScoreAvg != null ? `${snap.stats.weekScoreAvg}/10` : "—"}
          sub="Avg productivity"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-sky-500" />}
          label="Focus"
          value={
            snap.stats.focusMinutesToday > 0
              ? `${snap.stats.focusMinutesToday}m`
              : "0m"
          }
          sub="Tracked today"
        />
      </div>

      {/* ── Plan today — intentional daily list (Things 3 inspired) ──
           State 1 (no plan): auto-opens the drawer the FIRST visit of
           the IST day, then just renders a nudge card. State 2 (plan
           exists): renders the picked list with click-to-complete. */}
      <PlanTodaySection
        plan={hydratedPlan.plan}
        tasks={hydratedPlan.tasks}
        autoOpen={!hydratedPlan.plan}
      />

      {/* ── Hero row: primary capture + motivation side-by-side ───
           On desktop they balance each other; on mobile they stack. */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
                <Sparkles className="h-4 w-4" />
              </span>
              Capture anything
            </CardTitle>
            <CardDescription className="text-xs">
              Type what you need to do. Include a time like &ldquo;6pm&rdquo; or &ldquo;tomorrow 9am&rdquo; to make it a reminder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickCapture />
          </CardContent>
        </Card>

        {snap.motivation?.quote ? (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-white dark:border-amber-900/40 dark:from-amber-950/20 dark:to-zinc-900">
            <CardContent className="flex h-full items-start gap-3 py-5">
              <Quote className="mt-1 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm italic leading-relaxed text-zinc-900 dark:text-zinc-100">
                  &ldquo;{snap.motivation.quote}&rdquo;
                </p>
                {snap.motivation.reflection && (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {snap.motivation.reflection}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-zinc-200 bg-gradient-to-br from-zinc-50/80 to-white dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
            <CardContent className="flex h-full flex-col justify-center gap-2 py-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Today&apos;s pulse
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {snap.focusTasks.length === 0 && snap.completedTasksToday.length === 0
                  ? "A quiet start. Use Capture on the left to plan the next small move."
                  : snap.focusTasks.some((t) => t.is_overdue)
                  ? `${snap.focusTasks.filter((t) => t.is_overdue).length} overdue — clear those first, then the rest flows.`
                  : snap.completedTasksToday.length > 0
                  ? `Good progress — ${snap.completedTasksToday.length} done, ${snap.focusTasks.length} to go.`
                  : `${snap.focusTasks.length} focus item${snap.focusTasks.length === 1 ? "" : "s"} today. You've got this.`}
              </p>
              <Link
                href="/motivation"
                className="mt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Write today&apos;s motivation →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Main bento grid: do-stuff column + happening-today column ─── */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* LEFT — primary action column */}
        <div className="space-y-4">
          {/* Focus today */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                Focus today
                <span className="ml-auto text-xs font-normal text-zinc-400">
                  {snap.focusTasks.length} {snap.focusTasks.length === 1 ? "task" : "tasks"}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {snap.focusTasks.some((t) => t.is_overdue)
                  ? "Overdue items appear first — they need attention."
                  : "Due today or earlier, still open."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snap.focusTasks.length === 0 ? (
                <EmptyHint
                  icon={<CheckCircle2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
                  title="Nothing urgent on your plate"
                  body="Capture a todo above, or open All tasks to plan ahead."
                  linkHref="/tasks"
                  linkLabel="All tasks"
                />
              ) : (
                <div className="space-y-2">
                  {snap.focusTasks.map((t) => (
                    <TaskRow key={t.id} task={mappedFocusTask(t)} />
                  ))}
                  {snap.focusTasks.some((t) => t.is_overdue) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      Some items are overdue.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Up next this week — moved into LEFT column so the "do stuff" lane
              flows: what's urgent → what's coming. */}
          {snap.upcomingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="h-4 w-4 text-indigo-500" />
                  Up next this week
                </CardTitle>
                <CardDescription className="text-xs">
                  Due in the next 7 days — plan ahead without opening the full task list.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {snap.upcomingTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{t.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {t.due_date}
                          {t.due_time ? ` · ${t.due_time}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-right">
                  <Link href="/tasks" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    All tasks →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Done today (celebratory) */}
          {snap.completedTasksToday.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Done today
                  <span className="ml-auto text-xs font-normal text-zinc-400">
                    {snap.completedTasksToday.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Tasks you wrapped up in the last 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {snap.completedTasksToday.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 line-through transition hover:bg-emerald-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-emerald-950/30 dark:hover:text-zinc-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="truncate">{t.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT — happening-today column (narrower) */}
        <div className="space-y-4">

      {/* ── Today's events (calendar) ────────────────────────────── */}
      {snap.todaysEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-purple-500" />
              Events today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {snap.todaysEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800"
                >
                  <span
                    className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: e.color ?? "#8b5cf6" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatISTTime(e.start_time)} – {formatISTTime(e.end_time)}
                      {e.location && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-right">
              <Link href="/calendar" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Full calendar →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Today's reminders ────────────────────────────────────── */}
      {snap.todaysReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-amber-500" />
              Reminders firing today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snap.todaysReminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {r.title}
                      </p>
                      {r.is_private && <Lock className="h-3 w-3 shrink-0 text-amber-500" />}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatIST(r.reminder_time)} IST
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <Link href="/reminders" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                All reminders →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Today's work entry ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-emerald-500" />
            Today&apos;s log
          </CardTitle>
          <CardDescription className="text-xs">
            Capture what you got done — future-you will thank present-you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snap.entryToday ? (
            <Link
              href={`/entries/${snap.entryToday.id}`}
              className="block rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 transition hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {snap.entryToday.title}
              </p>
              {snap.entryToday.work_done && (
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                  {snap.entryToday.work_done}
                </p>
              )}
              <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                Open to edit →
              </p>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {snap.completedTasksToday.length > 0
                  ? `You completed ${snap.completedTasksToday.length} task${snap.completedTasksToday.length === 1 ? "" : "s"} today — want to log it?`
                  : "No entry for today yet."}
              </p>
              <Link
                href={`/entries/new?date=${todayKey}`}
                className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Draft today&apos;s entry →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      {/* ── Footer row: quick jumps to adjacent surfaces ─────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <JumpLink href="/mindmaps" label="Mind maps" icon={<Sparkles className="h-4 w-4" />} />
        <JumpLink href="/analytics" label="Analytics" icon={<Flame className="h-4 w-4" />} />
        <JumpLink href="/reminders" label="All reminders" icon={<Bell className="h-4 w-4" />} />
        <JumpLink href="/personal" label="Personal space" icon={<Lock className="h-4 w-4" />} />
      </div>
    </div>
    </>
  );
}


function JumpLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
    >
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getGreeting(): string {
  const istHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (istHour < 5) return "Late night";
  if (istHour < 12) return "Good morning";
  if (istHour < 17) return "Good afternoon";
  if (istHour < 21) return "Good evening";
  return "Good evening";
}

function EmptyHint({
  icon,
  title,
  body,
  linkHref,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {icon}
      <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{body}</p>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="mt-3 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
