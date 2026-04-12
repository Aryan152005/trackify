"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, FileText, ClipboardList, Columns3, Pencil, Brain, Target, BookOpen,
  Plus, Edit3, Tag, Trash2, Archive, UserPlus, LogIn,
} from "lucide-react";
import type { ActivityRow } from "@/lib/activity/actions";

const ENTITY_ICON: Record<string, React.ReactNode> = {
  page: <FileText className="h-3.5 w-3.5" />,
  task: <ClipboardList className="h-3.5 w-3.5" />,
  board: <Columns3 className="h-3.5 w-3.5" />,
  drawing: <Pencil className="h-3.5 w-3.5" />,
  mindmap: <Brain className="h-3.5 w-3.5" />,
  challenge: <Target className="h-3.5 w-3.5" />,
  entry: <BookOpen className="h-3.5 w-3.5" />,
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
  challenge: (id) => `/challenges/${id}`,
  entry: (id) => `/entries/${id}`,
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  created: <Plus className="h-3 w-3" />,
  edited: <Edit3 className="h-3 w-3" />,
  renamed: <Tag className="h-3 w-3" />,
  deleted: <Trash2 className="h-3 w-3" />,
  archived: <Archive className="h-3 w-3" />,
  invited: <UserPlus className="h-3 w-3" />,
  joined: <LogIn className="h-3 w-3" />,
};

const PAGE_SIZE = 50;

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  const [memberFilter, setMemberFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const members = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.user_id)) seen.set(r.user_id, r.actor_name);
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);
  const entities = useMemo(() => [...new Set(rows.map((r) => r.entity_type))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (memberFilter && r.user_id !== memberFilter) return false;
      if (actionFilter && r.action !== actionFilter) return false;
      if (entityFilter && r.entity_type !== entityFilter) return false;
      return true;
    });
  }, [rows, memberFilter, actionFilter, entityFilter]);

  const display = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <div>
      {/* Filter bar */}
      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterSelect value={memberFilter} onChange={setMemberFilter} placeholder="All members">
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </FilterSelect>
          <FilterSelect value={actionFilter} onChange={setActionFilter} placeholder="All actions">
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </FilterSelect>
          <FilterSelect value={entityFilter} onChange={setEntityFilter} placeholder="All items">
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </FilterSelect>
          {(memberFilter || actionFilter || entityFilter) && (
            <button
              type="button"
              onClick={() => { setMemberFilter(""); setActionFilter(""); setEntityFilter(""); }}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto self-center text-[11px] text-zinc-500 dark:text-zinc-400">
            Showing {display.length} of {filtered.length}
          </span>
        </div>
      )}

      {display.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          {rows.length === 0
            ? "No activity logged yet."
            : "No events match the current filters."}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {display.map((a) => {
              const href = ENTITY_HREF[a.entity_type]?.(a.entity_id);
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    {a.actor_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.actor_avatar} alt={a.actor_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-zinc-500">
                        {a.actor_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">{a.actor_name}</span>
                      <span className="mx-1 inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {ACTION_ICON[a.action] ?? <Activity className="h-3 w-3" />}
                        {a.action}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        {ENTITY_ICON[a.entity_type] ?? <Activity className="h-3 w-3" />}
                        {a.entity_type}
                      </span>
                      {href ? (
                        <Link href={href} className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          {a.entity_title}
                        </Link>
                      ) : (
                        <span className="ml-1 font-medium">{a.entity_title}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, placeholder, children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
