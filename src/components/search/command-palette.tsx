"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Loader2,
  FileText,
  CheckSquare,
  Columns,
  GitBranch,
  CalendarDays,
  BarChart3,
  Settings,
  FilePlus,
  ListPlus,
  LayoutDashboard,
  LayoutGrid,
  PenLine,
  Bell,
  Clock,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { globalSearch, getRecentItems, getQuickActions } from "@/lib/search/actions";
import { globalFtsSearch, type FtsResult } from "@/lib/search/fts-actions";
import type { SearchResult, QuickAction } from "@/lib/search/types";
import { SearchResultItem } from "./search-result-item";
import { SearchTrigger } from "./search-trigger";

// Lucide icon map for quick actions
const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  CheckSquare,
  Columns,
  GitBranch,
  CalendarDays,
  BarChart3,
  Settings,
  FilePlus,
  ListPlus,
  LayoutDashboard,
  LayoutGrid,
  PenLine,
  Bell,
  Clock,
  MessageSquare,
};

// Group labels for search result types
const TYPE_GROUP_LABELS: Record<string, string> = {
  page: "Pages",
  task: "Tasks",
  entry: "Work Entries",
  board: "Boards",
  mindmap: "Mind Maps",
  calendar_event: "Calendar Events",
  reminder: "Reminders",
  comment: "Comments",
};

const CATEGORY_LABELS: Record<string, string> = {
  create: "Create",
  navigate: "Navigate",
  settings: "Settings",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [ftsResults, setFtsResults] = useState<FtsResult[]>([]);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const router = useRouter();
  const workspaceId = useWorkspaceId();

  // -----------------------------------------------------------------------
  // Global Cmd+K handler
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // -----------------------------------------------------------------------
  // Load quick actions and recent items when opening
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setFtsResults([]);
    setActiveIndex(0);

    getQuickActions().then(setQuickActions);

    if (workspaceId) {
      getRecentItems(workspaceId, "").then(setRecentItems);
    }
  }, [open, workspaceId]);

  // -----------------------------------------------------------------------
  // Debounced search
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || !workspaceId) {
      setResults([]);
      setFtsResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const q = query.trim();
      const structuredPromise = globalSearch(workspaceId, q).catch(() => [] as SearchResult[]);
      const ftsPromise =
        q.length >= 3
          ? globalFtsSearch(q, workspaceId).catch(() => [] as FtsResult[])
          : Promise.resolve([] as FtsResult[]);

      try {
        const [data, fts] = await Promise.all([structuredPromise, ftsPromise]);
        setResults(data);
        setFtsResults(fts);
        setActiveIndex(0);
      } catch {
        setResults([]);
        setFtsResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, workspaceId]);

  // -----------------------------------------------------------------------
  // Build a flat list of selectable items for keyboard navigation
  // -----------------------------------------------------------------------
  const isSearching = query.trim().length > 0;

  // Group search results by type (preserving order)
  const groupedResults: { type: string; items: SearchResult[] }[] = [];
  if (isSearching) {
    const seen = new Set<string>();
    for (const r of results) {
      if (!seen.has(r.type)) {
        seen.add(r.type);
        groupedResults.push({ type: r.type, items: results.filter((x) => x.type === r.type) });
      }
    }
  }

  // Build flat selectable items
  type SelectableItem =
    | { kind: "result"; result: SearchResult }
    | { kind: "fts"; result: FtsResult }
    | { kind: "action"; action: QuickAction }
    | { kind: "recent"; result: SearchResult };

  // Dedupe FTS items against structured results by (type, id)
  const structuredKeys = new Set(results.map((r) => `${r.type}:${r.id}`));
  const dedupedFts = ftsResults.filter(
    (r) => !structuredKeys.has(`${r.type}:${r.id}`)
  );

  const selectableItems: SelectableItem[] = [];

  if (isSearching) {
    for (const group of groupedResults) {
      for (const item of group.items) {
        selectableItems.push({ kind: "result", result: item });
      }
    }
    for (const item of dedupedFts) {
      selectableItems.push({ kind: "fts", result: item });
    }
  } else {
    // Quick actions first, then recent items
    const filteredActions = quickActions.filter((a) =>
      a.label.toLowerCase().includes(query.toLowerCase())
    );
    for (const action of filteredActions) {
      selectableItems.push({ kind: "action", action });
    }
    for (const item of recentItems) {
      selectableItems.push({ kind: "recent", result: item });
    }
  }

  // -----------------------------------------------------------------------
  // Navigate to item
  // -----------------------------------------------------------------------
  const navigateTo = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router]
  );

  const selectItem = useCallback(
    (item: SelectableItem) => {
      if (item.kind === "action") {
        navigateTo(item.action.action);
      } else if (item.kind === "fts") {
        navigateTo(item.result.href);
      } else {
        navigateTo(item.result.url);
      }
    },
    [navigateTo]
  );

  // -----------------------------------------------------------------------
  // Keyboard navigation
  // -----------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent) {
    const total = selectableItems.length;
    if (!total) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % total);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + total) % total);
        break;
      case "Enter":
        e.preventDefault();
        if (selectableItems[activeIndex]) {
          selectItem(selectableItems[activeIndex]);
        }
        break;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector("[aria-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  let flatIndex = -1;

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />
      {/* Mobile-only icon trigger — the desktop SearchTrigger is
          `hidden sm:flex` so on phones it renders nothing. This one
          fills that gap; placed here so both triggers share the same
          open state + keyboard handler. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <Search className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                />
              </Dialog.Overlay>

              <Dialog.Content
                asChild
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
              >
                <motion.div
                  className="fixed inset-x-0 top-[15vh] z-50 mx-auto w-full max-w-xl px-4"
                  initial={{ opacity: 0, scale: 0.96, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                    {/* Search input */}
                    <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-700">
                      <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                      <Dialog.Title className="sr-only">
                        Search or run a command
                      </Dialog.Title>
                      <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search pages, tasks, boards... or type a command"
                        className="h-12 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      {loading && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                      )}
                      <kbd className="hidden shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline-block dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500">
                        ESC
                      </kbd>
                    </div>

                    {/* Results area */}
                    <div
                      ref={listRef}
                      className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
                      role="listbox"
                    >
                      {/* --- Searching state --- */}
                      {isSearching && !loading && results.length === 0 && dedupedFts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                          <Search className="mb-2 h-8 w-8" />
                          <p className="text-sm">
                            No results for &ldquo;{query}&rdquo;
                          </p>
                          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                            Try a different search term
                          </p>
                        </div>
                      )}

                      {/* --- Search results grouped by type --- */}
                      {isSearching &&
                        groupedResults.map((group) => (
                          <div key={group.type} className="mb-1">
                            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              {TYPE_GROUP_LABELS[group.type] ?? group.type}
                            </div>
                            {group.items.map((result) => {
                              flatIndex++;
                              const idx = flatIndex;
                              return (
                                <SearchResultItem
                                  key={result.id}
                                  result={result}
                                  isActive={activeIndex === idx}
                                  query={query}
                                  onClick={() =>
                                    selectItem({ kind: "result", result })
                                  }
                                />
                              );
                            })}
                          </div>
                        ))}

                      {/* --- Full-text match section --- */}
                      {isSearching && dedupedFts.length > 0 && (
                        <div className="mb-1">
                          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            Full-text matches
                          </div>
                          {dedupedFts.map((item) => {
                            flatIndex++;
                            const idx = flatIndex;
                            const adapted: SearchResult = {
                              id: item.id,
                              type: item.type,
                              title: item.title,
                              subtitle: item.snippet,
                              url: item.href,
                              icon:
                                item.type === "task"
                                  ? "CheckSquare"
                                  : item.type === "entry"
                                  ? "Clock"
                                  : item.type === "page"
                                  ? "FileText"
                                  : "Bell",
                              updatedAt: item.updatedAt ?? "",
                              highlight: item.snippet,
                            };
                            return (
                              <SearchResultItem
                                key={`fts-${item.type}-${item.id}`}
                                result={adapted}
                                isActive={activeIndex === idx}
                                query={query}
                                onClick={() =>
                                  selectItem({ kind: "fts", result: item })
                                }
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* --- Empty state: quick actions + recent --- */}
                      {!isSearching && (
                        <>
                          {/* Quick actions by category */}
                          {(["create", "navigate", "settings"] as const).map(
                            (cat) => {
                              const actions = quickActions.filter(
                                (a) => a.category === cat
                              );
                              if (!actions.length) return null;
                              return (
                                <div key={cat} className="mb-1">
                                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                    {CATEGORY_LABELS[cat]}
                                  </div>
                                  {actions.map((action) => {
                                    flatIndex++;
                                    const idx = flatIndex;
                                    const Icon =
                                      ACTION_ICON_MAP[action.icon] ?? ArrowRight;
                                    return (
                                      <button
                                        key={action.id}
                                        type="button"
                                        onClick={() =>
                                          selectItem({ kind: "action", action })
                                        }
                                        className={cn(
                                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                          activeIndex === idx
                                            ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
                                            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                                        )}
                                        role="option"
                                        aria-selected={activeIndex === idx}
                                      >
                                        <div
                                          className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                            activeIndex === idx
                                              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-400"
                                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                          )}
                                        >
                                          <Icon className="h-4 w-4" />
                                        </div>
                                        <span className="flex-1">
                                          {action.label}
                                        </span>
                                        {action.shortcut && (
                                          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500">
                                            {action.shortcut}
                                          </kbd>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            }
                          )}

                          {/* Recent items */}
                          {recentItems.length > 0 && (
                            <div className="mb-1">
                              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                Recent
                              </div>
                              {recentItems.map((item) => {
                                flatIndex++;
                                const idx = flatIndex;
                                return (
                                  <SearchResultItem
                                    key={`recent-${item.id}`}
                                    result={item}
                                    isActive={activeIndex === idx}
                                    query=""
                                    onClick={() =>
                                      selectItem({ kind: "recent", result: item })
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1">
                          <kbd className="rounded border border-zinc-200 px-1 py-0.5 font-mono dark:border-zinc-600">
                            &uarr;&darr;
                          </kbd>
                          Navigate
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="rounded border border-zinc-200 px-1 py-0.5 font-mono dark:border-zinc-600">
                            &crarr;
                          </kbd>
                          Select
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="rounded border border-zinc-200 px-1 py-0.5 font-mono dark:border-zinc-600">
                            esc
                          </kbd>
                          Close
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {isSearching
                          ? `${results.length + dedupedFts.length} result${results.length + dedupedFts.length !== 1 ? "s" : ""}`
                          : "Type to search"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </AnimatePresence>
    </>
  );
}
