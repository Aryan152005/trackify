"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  icon: string | null;
  saveStatus: "idle" | "saving" | "saved";
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string) => void;
}

export function PageHeader({
  title,
  icon,
  saveStatus,
  onTitleChange,
  onIconChange,
}: PageHeaderProps) {
  const [showIconInput, setShowIconInput] = useState(false);
  const [iconValue, setIconValue] = useState(icon ?? "");
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconSubmit = useCallback(() => {
    const trimmed = iconValue.trim();
    if (trimmed) {
      onIconChange(trimmed);
    }
    setShowIconInput(false);
  }, [iconValue, onIconChange]);

  return (
    <div className="mb-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notes
        </Link>

        <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Icon + Title */}
      <div className="flex items-start gap-3">
        {/* Icon button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowIconInput(true);
              setTimeout(() => iconInputRef.current?.focus(), 50);
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Change icon"
          >
            {icon || "\ud83d\udcc4"}
          </button>

          {showIconInput && (
            <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Enter an emoji
              </label>
              <input
                ref={iconInputRef}
                type="text"
                value={iconValue}
                onChange={(e) => setIconValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleIconSubmit();
                  if (e.key === "Escape") setShowIconInput(false);
                }}
                onBlur={handleIconSubmit}
                className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                maxLength={4}
                placeholder="\ud83d\udcc4"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full border-none bg-transparent text-4xl font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
