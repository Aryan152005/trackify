"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  LayoutDashboard, FileText, CheckSquare, Columns3, StickyNote,
  Calendar, BarChart3, Bell, Users, Sparkles, Pencil, Brain,
  X, ArrowLeft, ArrowRight, Rocket, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "trackify-welcome-tour-done";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  title: string;
  subtitle: string;
  body: string;
  tryUrl?: string;
  tryLabel?: string;
}

const STEPS: Step[] = [
  {
    icon: Rocket,
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    title: "Welcome to Trackify",
    subtitle: "Your all-in-one workspace",
    body: "Let's take a 2-minute tour so you know what's where. You can skip anytime — reopen from the Help menu.",
  },
  {
    icon: LayoutDashboard,
    gradient: "from-indigo-500 to-blue-500",
    title: "Dashboard",
    subtitle: "Your command center",
    body: "See today's stats, streak, pending tasks, charts, and a live calendar of your work — all in one place. Hover any calendar day for a quick preview.",
    tryUrl: "/dashboard",
    tryLabel: "Open dashboard",
  },
  {
    icon: FileText,
    gradient: "from-emerald-500 to-teal-500",
    title: "Work Entries",
    subtitle: "Log what you did today",
    body: "Capture daily work with productivity scores, mood, what you learned, tomorrow's plan, and photo proof. Builds your streak.",
    tryUrl: "/entries/new",
    tryLabel: "Add an entry",
  },
  {
    icon: CheckSquare,
    gradient: "from-amber-500 to-orange-500",
    title: "Tasks & Boards",
    subtitle: "Plan and visualize work",
    body: "Create tasks with priority, due dates, subtasks. Drag them around Kanban boards to see your workflow at a glance.",
    tryUrl: "/tasks/new",
    tryLabel: "Create a task",
  },
  {
    icon: StickyNote,
    gradient: "from-purple-500 to-pink-500",
    title: "Notes",
    subtitle: "Notion-style writing",
    body: "Block-based editor for meeting notes, project briefs, anything. Rich text, headings, lists, checkboxes, code blocks.",
    tryUrl: "/notes",
    tryLabel: "Open Notes",
  },
  {
    icon: Calendar,
    gradient: "from-blue-500 to-cyan-500",
    title: "Calendar & Reminders",
    subtitle: "Never miss a thing",
    body: "Schedule events, set reminders, get push notifications on your phone even when the app is closed. Enable notifications when prompted.",
    tryUrl: "/reminders",
    tryLabel: "Set a reminder",
  },
  {
    icon: Brain,
    gradient: "from-violet-500 to-fuchsia-500",
    title: "Smart Mindmap",
    subtitle: "AI-style auto-connections",
    body: "Auto-generates a map of all your tasks, reminders, entries, and notes — connects them by keywords and dates. One-click actions to link related items.",
    tryUrl: "/mindmaps/smart",
    tryLabel: "Try Smart Mindmap",
  },
  {
    icon: BarChart3,
    gradient: "from-pink-500 to-rose-500",
    title: "Analytics & Reports",
    subtitle: "Spot your patterns",
    body: "Interactive charts, trend analysis, tag performance. Export polished PDFs, Word docs, or Excel sheets for sharing.",
    tryUrl: "/analytics",
    tryLabel: "See analytics",
  },
  {
    icon: Users,
    gradient: "from-sky-500 to-indigo-500",
    title: "Team Collaboration",
    subtitle: "Work together, live",
    body: "Invite teammates to your workspace, share tasks and notes, see live cursors and @mentions. Every person still has a Personal Space for private items.",
    tryUrl: "/workspace/members",
    tryLabel: "Invite team",
  },
  {
    icon: Pencil,
    gradient: "from-zinc-500 to-zinc-700",
    title: "Drawings & More",
    subtitle: "Excalidraw canvas, mindmaps, timelines",
    body: "Free-form drawing canvas, classic mindmaps, Gantt-style timelines, bookings, integrations — explore from the More menu.",
    tryUrl: "/drawings",
    tryLabel: "Start drawing",
  },
  {
    icon: Sparkles,
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    title: "You're all set",
    subtitle: "Ready to start?",
    body: "This tour is always available from Help → Walkthrough. Happy tracking!",
  },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-open for new users; also support ?tour=1 for re-opening
    const params = new URLSearchParams(window.location.search);
    const force = params.get("tour") === "1";
    if (force) {
      setOpen(true);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Listen for a custom event so Help page can open the tour
  useEffect(() => {
    function onEvt() {
      setStepIdx(0);
      setOpen(true);
    }
    window.addEventListener("trackify:open-tour", onEvt);
    return () => window.removeEventListener("trackify:open-tour", onEvt);
  }, []);

  function markDone() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  function close() {
    markDone();
    setOpen(false);
  }

  function next() {
    if (stepIdx === STEPS.length - 1) {
      close();
      return;
    }
    setStepIdx((i) => i + 1);
  }

  function prev() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  if (!mounted || !open) return null;

  const step = STEPS[stepIdx];
  const Icon = step.icon;
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  return (
    <AnimatePresence>
      <motion.div
        key="tour-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <motion.div
        key={`tour-card-${stepIdx}`}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22 }}
        className="fixed left-1/2 top-1/2 z-[71] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2"
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
          {/* Hero */}
          <div className={`relative bg-gradient-to-br ${step.gradient} p-8 text-white`}>
            <button
              onClick={close}
              className="absolute right-3 top-3 rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Icon className="h-7 w-7" />
              </div>
            </div>
            <p className="mt-4 text-center text-xs font-semibold uppercase tracking-wider text-white/80">
              {step.subtitle}
            </p>
            <h2 className="mt-1 text-center text-2xl font-bold tracking-tight">
              {step.title}
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {step.body}
            </p>

            {step.tryUrl && (
              <div className="mt-4 flex justify-center">
                <Link href={step.tryUrl} onClick={close}>
                  <Button size="sm" variant="outline">
                    {step.tryLabel ?? "Try it"} →
                  </Button>
                </Link>
              </div>
            )}

            {/* Progress dots */}
            <div className="mt-5 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIdx
                      ? "w-6 bg-indigo-500"
                      : i < stepIdx
                      ? "w-1.5 bg-indigo-300 dark:bg-indigo-700"
                      : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <button
              onClick={close}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button size="sm" variant="outline" onClick={prev}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Let&apos;s go
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Counter */}
          <p className="border-t border-zinc-100 bg-zinc-50 px-5 py-2 text-center text-[11px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50">
            Step {stepIdx + 1} of {STEPS.length} · Arrow keys to navigate · Esc to close
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
