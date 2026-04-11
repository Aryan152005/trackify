"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPageFromTemplate } from "@/lib/smart/actions";
import {
  Plus,
  FileText,
  CheckSquare,
  Columns3,
  StickyNote,
  Brain,
  Pencil,
  Loader2,
} from "lucide-react";

const quickActions = [
  { label: "New Entry", href: "/entries/new", icon: FileText, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
  { label: "New Task", href: "/tasks/new", icon: CheckSquare, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { label: "New Board", href: "/boards/new", icon: Columns3, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { label: "New Reminder", href: "/reminders/new", icon: Plus, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
];

const templateActions = [
  { id: "meeting-notes", label: "Meeting Notes", icon: "📝" },
  { id: "project-brief", label: "Project Brief", icon: "🎯" },
  { id: "weekly-review", label: "Weekly Review", icon: "📊" },
  { id: "daily-standup", label: "Daily Standup", icon: "☀️" },
  { id: "blank", label: "Blank Page", icon: "📄" },
];

export function QuickActions() {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  async function handleTemplate(templateId: string) {
    setCreating(templateId);
    try {
      const page = await createPageFromTemplate(templateId);
      router.push(`/notes/${page.id}`);
    } catch {
      setCreating(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick create */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Quick Create</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${action.color}`}>
                <action.icon className="h-3.5 w-3.5" />
              </span>
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Start from Template</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {templateActions.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplate(t.id)}
              disabled={creating !== null}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
            >
              {creating === t.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-base">{t.icon}</span>
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
