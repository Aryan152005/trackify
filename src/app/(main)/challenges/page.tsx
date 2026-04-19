import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listChallenges } from "@/lib/challenges/actions";
import { computeStats, currentDayIndex } from "@/lib/challenges/helpers";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import type { Challenge } from "@/lib/challenges/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Target, Plus, Columns3, Map, CheckCircle2, Calendar } from "lucide-react";
import { SharedSection } from "@/components/collaboration/shared-section";
import { formatDistanceToNow } from "date-fns";

const MODE_ICONS = { habit: CheckCircle2, kanban: Columns3, roadmap: Map };
const MODE_LABELS = { habit: "Habit tracker", kanban: "Kanban plan", roadmap: "Roadmap" };
const MODE_COLORS = {
  habit: "from-emerald-500 to-teal-500",
  kanban: "from-amber-500 to-orange-500",
  roadmap: "from-indigo-500 to-purple-500",
};

export default async function ChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();
  const challenges = await listChallenges(workspaceId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="21-Day Challenges"
        description="Commit to 21 days (or any span) of a habit, a project plan, or a roadmap."
        actions={
          <Link href="/challenges/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Challenge
            </Button>
          </Link>
        }
      />

      {challenges.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No challenges yet"
          description="Start a 21-day habit, a daily kanban plan, or a week-by-week roadmap."
          hint="Pick one thing to get better at for the next three weeks — showing up is what compounds, not any single day."
          actionLabel="Start your first challenge"
          actionHref="/challenges/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* Mode explainer */}
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
          {(Object.keys(MODE_ICONS) as Array<keyof typeof MODE_ICONS>).map((k) => {
            const Icon = MODE_ICONS[k];
            return (
              <div key={k} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${MODE_COLORS[k]} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{MODE_LABELS[k]}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {k === "habit" && "One checkbox per day. Build streaks."}
                    {k === "kanban" && "Each day has its own mini to-do list. Great for bootcamps."}
                    {k === "roadmap" && "Write out goals for each day. Good for product launches."}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <SharedSection entityType="challenge" />
    </div>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  const { done, total, streak } = computeStats(c);
  const day = currentDayIndex(c) + 1;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const Icon = MODE_ICONS[c.mode];
  return (
    <Link href={`/challenges/${c.id}`}>
      <Card className="group h-full transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${MODE_COLORS[c.mode]} text-white shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{c.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {MODE_LABELS[c.mode]} · Day {day} of {total}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>{done}/{total} done · {pct}%</span>
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3 text-indigo-500" /> {streak} streak
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full bg-gradient-to-r ${MODE_COLORS[c.mode]} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400">
            <Calendar className="h-3 w-3" />
            Started {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
