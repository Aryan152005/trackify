"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPersonalWorkspace } from "@/lib/workspace/actions";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  FileText,
  CheckSquare,
  Columns3,
  StickyNote,
  BarChart3,
  Bell,
  Users,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Track Your Work",
    desc: "Log daily entries with productivity scores. See your progress over time and build streaks.",
    color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  {
    icon: CheckSquare,
    title: "Manage Tasks",
    desc: "Create tasks with priorities and due dates. Organize them on Kanban boards with drag-and-drop.",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    icon: StickyNote,
    title: "Write Notes",
    desc: "A Notion-like editor for meeting notes, project briefs, and anything else. Start from templates.",
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    icon: Columns3,
    title: "Visual Boards",
    desc: "Kanban boards to visualize your workflow. Drag tasks between columns as they progress.",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "Charts, trends, and exportable reports (PDF, Word, Excel) to share with your team.",
    color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "Set reminders and get push notifications on your phone — even when the app is in the background.",
    color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Share pages, leave comments, @mention teammates, and see who's online in real-time.",
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<"name" | "tour" | "done">("name");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkProfile();
  }, []);

  async function checkProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase
      .from("user_profiles").select("name").eq("user_id", user.id).single();
    if (profile) router.push("/dashboard");
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); return; }

      const { error: insertError } = await supabase.from("user_profiles").insert({
        user_id: user.id,
        name: name.trim(),
      });

      if (insertError) {
        if (insertError.code === "23505") {
          await supabase.from("user_profiles").update({ name: name.trim() }).eq("user_id", user.id);
        } else {
          setError(insertError.message);
          return;
        }
      }

      await createPersonalWorkspace(user.id, name.trim());
      setStep("tour");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (step === "name") {
    return (
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 py-8 sm:items-center dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-6 text-center">
            <Image src="/icons/icon-192.png" alt="Trackify" width={48} height={48} className="mx-auto mb-3 rounded-xl" />
            <div className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              Step 1 of 2
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Welcome to Trackify!</h1>
            <p className="mt-1 text-sm text-zinc-500">Let&apos;s set up your workspace in 30 seconds</p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                What should we call you?
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aryan"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
                autoFocus
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up your workspace..." : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "tour") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 py-8 sm:justify-center dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="w-full max-w-3xl">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Here&apos;s what you can do with Trackify
            </h1>
            <p className="mt-2 text-sm text-zinc-500 sm:text-base">Everything you need to be productive, in one place</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{f.title}</h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center sm:mt-8">
            <Button
              size="lg"
              onClick={() => router.push("/dashboard?tour=1")}
              className="w-full gap-2 px-8 sm:w-auto"
            >
              Start the tour
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-3 text-xs text-zinc-400">
              You can always revisit this from Settings &gt; Help &amp; Guide
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
