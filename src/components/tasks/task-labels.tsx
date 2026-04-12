"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Tag, Plus, X } from "lucide-react";
import type { Label } from "@/lib/types/board";

const LABEL_COLORS = [
  { name: "Gray", value: "#71717a" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

interface Props {
  labels: Label[];
  onChange: (next: Label[]) => void;
  readOnly?: boolean;
  small?: boolean;
}

export function TaskLabels({ labels, onChange, readOnly, small }: Props) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(LABEL_COLORS[6].value);

  function addLabel() {
    const name = draftName.trim();
    if (!name) return;
    if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      setDraftName("");
      return;
    }
    onChange([...labels, { name, color: draftColor }]);
    setDraftName("");
  }

  function removeLabel(name: string) {
    onChange(labels.filter((l) => l.name !== name));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span
          key={l.name}
          className={`inline-flex items-center gap-1 rounded-full font-medium ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
          style={{ backgroundColor: `${l.color}20`, color: l.color }}
        >
          {l.name}
          {!readOnly && (
            <button
              type="button"
              onClick={() => removeLabel(l.name)}
              className="-mr-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
              aria-label={`Remove ${l.name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 text-zinc-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400 ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
            >
              <Plus className="h-2.5 w-2.5" />
              {labels.length === 0 ? (
                <>
                  <Tag className="h-2.5 w-2.5" />
                  Add label
                </>
              ) : (
                "Add"
              )}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                New label
              </p>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addLabel(); }
                }}
                placeholder="Label name"
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setDraftColor(c.value)}
                    className={`h-5 w-5 rounded-full border-2 transition ${draftColor === c.value ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={addLabel}
                disabled={!draftName.trim()}
                className="mt-2 w-full rounded-md bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Add label
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
