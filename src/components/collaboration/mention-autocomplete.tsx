"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { searchUsers } from "@/lib/collaboration/mentions-actions";

interface MentionUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MentionAutocompleteProps {
  onSelect: (user: { id: string; name: string }) => void;
  query: string;
  workspaceId: string;
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

function hashUserId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColorClass(id: string): string {
  return AVATAR_COLORS[hashUserId(id) % AVATAR_COLORS.length];
}

export function MentionAutocomplete({
  onSelect,
  query,
  workspaceId,
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  useEffect(() => {
    if (!workspaceId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchUsers(workspaceId, query);
        setUsers(results);
        setActiveIndex(0);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, workspaceId]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (users.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % users.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + users.length) % users.length);
          break;
        case "Enter":
          e.preventDefault();
          if (users[activeIndex]) {
            onSelect({
              id: users[activeIndex].id,
              name: users[activeIndex].name,
            });
          }
          break;
        case "Escape":
          e.preventDefault();
          setUsers([]);
          break;
      }
    },
    [users, activeIndex, onSelect]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (users.length === 0 && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto p-1">
        {loading ? (
          <div className="flex items-center justify-center py-3 text-sm text-zinc-500 dark:text-zinc-400">
            Searching...
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {users.map((user, index) => (
              <motion.button
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => onSelect({ id: user.id, name: user.name })}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                )}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                      getColorClass(user.id)
                    )}
                  >
                    {(user.name.charAt(0) || "?").toUpperCase()}
                  </div>
                )}
                <span className="truncate font-medium">{user.name}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
