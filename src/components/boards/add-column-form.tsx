"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AddColumnFormProps {
  onSubmit: (name: string, color: string) => Promise<void>;
  onCancel: () => void;
}

const PRESET_COLORS: { name: string; value: string }[] = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Zinc", value: "#71717a" },
];

export function AddColumnForm({ onSubmit, onCancel }: AddColumnFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed, color);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-72 shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      {/* Name input */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Column name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />

      {/* Color picker */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Color
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110",
                color === preset.value && "ring-2 ring-offset-1 ring-zinc-400 dark:ring-offset-zinc-800"
              )}
              style={{ backgroundColor: preset.value }}
              onClick={() => setColor(preset.value)}
            >
              {color === preset.value && (
                <Check className="h-3 w-3 text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!name.trim() || submitting}>
          {submitting ? "Adding..." : "Add Column"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
