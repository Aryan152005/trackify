"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { createChallenge, type ChallengeMode } from "@/lib/challenges/actions";
import { CheckCircle2, Columns3, Map, Loader2 } from "lucide-react";

const MODES: { id: ChallengeMode; title: string; description: string; Icon: typeof CheckCircle2; tone: string }[] = [
  {
    id: "habit", title: "Habit tracker",
    description: "One checkbox per day. Perfect for meditation, reading, workouts.",
    Icon: CheckCircle2, tone: "from-emerald-500 to-teal-500",
  },
  {
    id: "kanban", title: "Kanban plan",
    description: "Each day has its own mini task list. Great for bootcamps and courses.",
    Icon: Columns3, tone: "from-amber-500 to-orange-500",
  },
  {
    id: "roadmap", title: "Roadmap",
    description: "Write goals for each day. Ideal for launches and big projects.",
    Icon: Map, tone: "from-indigo-500 to-purple-500",
  },
];

export default function NewChallengePage() {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [mode, setMode] = useState<ChallengeMode>("habit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(21);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const c = await createChallenge({
        mode,
        title: title.trim(),
        description: description.trim() || undefined,
        durationDays: duration,
        workspaceId,
      });
      toast.success(`"${c.title}" started! Day 1 is today.`);
      router.push(`/challenges/${c.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create challenge");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Start a challenge"
        description="Pick a mode, give it a name, and commit."
        backHref="/challenges"
        backLabel="Back to Challenges"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mode picker */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Mode
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:border-indigo-600 dark:bg-indigo-950/30"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${m.tone} text-white shadow-sm`}>
                    <m.Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{m.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={mode === "habit" ? "e.g. Meditate every morning" : mode === "kanban" ? "e.g. Backend bootcamp" : "e.g. Product launch roadmap"}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Why are you doing this?"
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Duration
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[7, 14, 21, 30, 60, 90].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDuration(n)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      duration === n
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {n} days
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/challenges")} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start challenge
          </Button>
        </div>
      </form>
    </div>
  );
}
