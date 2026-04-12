"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPageFromTemplate } from "@/lib/notes/actions";

interface Template {
  id: string;
  title: string;
  icon: string | null;
}

interface Props {
  templates: Template[];
  workspaceId: string;
}

/**
 * Horizontal row of template chips at the top of /notes. Click = create a new
 * page from that template and navigate to it.
 */
export function TemplatePickerBar({ templates, workspaceId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (templates.length === 0) return null;

  function pick(t: Template) {
    if (busyId) return;
    setBusyId(t.id);
    startTransition(() => {
      createPageFromTemplate(t.id, workspaceId)
        .then((page) => {
          toast.success(`Created "${page.title}" from template`);
          router.push(`/notes/${page.id}`);
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Couldn't create page");
        })
        .finally(() => setBusyId(null));
    });
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Start from a template
        </h3>
      </div>
      <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
        Click to create a new page with pre-filled content. Templates are reusable — they stay unchanged.
      </p>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const busy = busyId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={pending}
              onClick={() => pick(t)}
              className="group inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : t.icon ? (
                <span>{t.icon}</span>
              ) : (
                <FileText className="h-3.5 w-3.5 opacity-70" />
              )}
              <span className="truncate max-w-[180px]">{t.title || "Untitled template"}</span>
              <Plus className="h-3 w-3 opacity-40 transition group-hover:opacity-80" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
