"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SearchTriggerProps {
  onClick: () => void;
  className?: string;
}

export function SearchTrigger({ onClick, className }: SearchTriggerProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hidden items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 sm:flex dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
        className
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="max-w-[80px] truncate lg:max-w-none">Search...</span>
      <kbd className="ml-1 hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-400 md:inline-block dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-500">
        {isMac ? "⌘" : "Ctrl+"}K
      </kbd>
    </button>
  );
}
