"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search } from "lucide-react";

interface EntryRow {
  id: string;
  date: string;
  title: string;
  status: string;
  productivity_score: number | null;
  tags: { name: string; color: string }[];
}

const STATUS_OPTIONS = ["all", "done", "in-progress", "blocked"] as const;
const PAGE = 20;

export function EntriesList({ rows }: { rows: EntryRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tag, setTag] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const allTags = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) for (const t of r.tags) names.add(t.name);
    return [...names].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (tag && !r.tags.some((t) => t.name === tag)) return false;
      return true;
    });
  }, [rows, search, status, from, to, tag]);

  const display = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;
  const activeFilters = search || status !== "all" || from || to || tag;

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisible(PAGE); }}
            placeholder="Search title…"
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setVisible(PAGE); }}
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setVisible(PAGE); }}
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setVisible(PAGE); }}
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          title="To date"
        />
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => { setTag(e.target.value); setVisible(PAGE); }}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {activeFilters && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatus("all"); setFrom(""); setTo(""); setTag(""); setVisible(PAGE); }}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-[11px] text-zinc-500 dark:text-zinc-400">
          {display.length} of {filtered.length}
        </span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {display.map((entry) => (
          <Link
            key={entry.id}
            href={`/entries/${entry.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>{format(new Date(entry.date), "MMM d, yyyy")}</span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {entry.status}
              </span>
            </div>
            <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</p>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {entry.tags.slice(0, 3).map((t) => (
                  <span
                    key={t.name}
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: `${t.color}20`, color: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {entry.productivity_score != null ? `${entry.productivity_score}/10` : "—"}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 sm:block">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              {["Date", "Title", "Status", "Score", "Tags"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {display.map((entry) => (
              <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {format(new Date(entry.date), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/entries/${entry.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    {entry.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{entry.status}</td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.productivity_score ?? "—"}/10
                </td>
                <td className="px-4 py-3">
                  {entry.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {entry.tags.map((t) => (
                        <span
                          key={t.name}
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${t.color}20`, color: t.color }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {display.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">
          {rows.length === 0 ? "No entries yet." : "No entries match these filters."}
        </p>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Load {Math.min(PAGE, filtered.length - visible)} more
          </button>
        </div>
      )}
    </div>
  );
}
