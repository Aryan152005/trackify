"use client";

import { useMemo, useState } from "react";
import {
  addMonths, endOfMonth, startOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CheckSquare, Bell, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import Link from "next/link";

interface DayTask { id: string; title: string; due_date: string; due_time: string | null; priority: string | null; status: string }
interface DayReminder { id: string; title: string; reminder_time: string; is_completed: boolean }
interface DayEntry { id: string; title: string; date: string; status: string; productivity_score: number | null }

interface Props {
  tasks: DayTask[];
  reminders: DayReminder[];
  entries: DayEntry[];
}

export function DashboardCalendar({ tasks, reminders, entries }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Pre-bucket items by YYYY-MM-DD
  const byDate = useMemo(() => {
    const map = new Map<string, { tasks: DayTask[]; reminders: DayReminder[]; entries: DayEntry[] }>();
    const bucket = (key: string) => {
      if (!map.has(key)) map.set(key, { tasks: [], reminders: [], entries: [] });
      return map.get(key)!;
    };
    tasks.forEach((t) => { if (t.due_date) bucket(t.due_date.slice(0, 10)).tasks.push(t); });
    reminders.forEach((r) => { if (r.reminder_time) bucket(r.reminder_time.slice(0, 10)).reminders.push(r); });
    entries.forEach((e) => { if (e.date) bucket(e.date.slice(0, 10)).entries.push(e); });
    return map;
  }, [tasks, reminders, entries]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const monthLabel = format(cursor, "MMMM yyyy");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Calendar</CardTitle>
          <CardDescription className="text-xs">Tasks, reminders, entries at a glance. Hover a day for details.</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[110px] text-center text-sm font-medium">{monthLabel}</div>
          <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())} className="ml-1 text-xs">
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          (() => {
            const monthStart = startOfMonth(cursor);
            const monthEnd = endOfMonth(cursor);
            const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
            const activeDays = monthDays.filter((d) => {
              const data = byDate.get(format(d, "yyyy-MM-dd"));
              return !!(data && (data.tasks.length || data.reminders.length || data.entries.length));
            });
            if (activeDays.length === 0) {
              return (
                <p className="py-8 text-center text-sm text-zinc-400">No scheduled items this month</p>
              );
            }
            return (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activeDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const data = byDate.get(key)!;
                  const total = data.tasks.length + data.reminders.length + data.entries.length;
                  const overdueTasks = data.tasks.filter((t) => t.status !== "done" && parseISO(t.due_date) < new Date() && !isSameDay(parseISO(t.due_date), new Date())).length;
                  const titles: string[] = [
                    ...data.tasks.slice(0, 2).map((t) => t.title),
                    ...data.reminders.slice(0, 2).map((r) => r.title),
                    ...data.entries.slice(0, 2).map((e) => e.title),
                  ].slice(0, 2);
                  return (
                    <li key={key}>
                      <Link
                        href={`/calendar?date=${key}`}
                        className={`flex items-center gap-3 px-1 py-2.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${isToday(day) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}
                      >
                        <div className="w-16 shrink-0">
                          <div className={`text-sm font-semibold ${isToday(day) ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                            {format(day, "EEE d")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {data.tasks.length > 0 && (
                            <span className={`inline-block h-2 w-2 rounded-full ${overdueTasks > 0 ? "bg-red-500" : "bg-indigo-500"}`} />
                          )}
                          {data.reminders.length > 0 && (
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          )}
                          {data.entries.length > 0 && (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {titles.length > 0 && (
                            <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                              {titles.join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {total}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            );
          })()
        ) : (
          <>
        {/* Weekday headers */}
        <div className="mb-1 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1 py-1 text-center">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const data = byDate.get(key);
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            const hoveredKeyStr = hoveredKey;
            const isDimmed = hoveredKeyStr !== null && hoveredKeyStr !== key && !data;
            const hasActivity = !!(data && (data.tasks.length || data.reminders.length || data.entries.length));

            return (
              <DayCell
                key={key}
                day={day}
                dayKey={key}
                inMonth={inMonth}
                today={today}
                dimmed={isDimmed}
                data={data}
                hasActivity={hasActivity}
                onHover={(k) => setHoveredKey(k)}
              />
            );
          })}
        </div>
          </>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-2.5 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" /> Task
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Reminder
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Entry
          </span>
          <span className="ml-auto">
            <Link href="/calendar" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Open full calendar →
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DayCell({
  day, dayKey, inMonth, today, dimmed, data, hasActivity, onHover,
}: {
  day: Date;
  dayKey: string;
  inMonth: boolean;
  today: boolean;
  dimmed: boolean;
  data?: { tasks: DayTask[]; reminders: DayReminder[]; entries: DayEntry[] };
  hasActivity: boolean;
  onHover: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const totalItems = data ? data.tasks.length + data.reminders.length + data.entries.length : 0;
  const overdueTasks = data?.tasks.filter((t) => t.status !== "done" && parseISO(t.due_date) < new Date() && !isSameDay(parseISO(t.due_date), new Date())).length ?? 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => { setOpen(true); onHover(dayKey); }}
      onMouseLeave={() => { setOpen(false); onHover(null); }}
    >
      <Link
        href={`/calendar?date=${dayKey}`}
        className={`
          flex h-16 flex-col rounded-md border p-1.5 text-left transition
          ${inMonth ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" : "border-transparent bg-zinc-50/50 dark:bg-zinc-900/30"}
          ${today ? "ring-2 ring-indigo-500" : ""}
          ${dimmed ? "opacity-30" : ""}
          ${hasActivity ? "hover:bg-indigo-50 dark:hover:bg-indigo-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}
          ${!inMonth ? "opacity-40" : ""}
        `}
      >
        <div className="flex items-start justify-between">
          <span className={`text-xs font-medium ${today ? "text-indigo-600 dark:text-indigo-400" : inMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
            {format(day, "d")}
          </span>
          {totalItems > 0 && (
            <span className="text-[9px] font-semibold text-zinc-400">{totalItems}</span>
          )}
        </div>
        {data && (
          <div className="mt-auto flex flex-wrap gap-0.5">
            {data.tasks.length > 0 && (
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${overdueTasks > 0 ? "bg-red-500" : "bg-indigo-500"}`} />
            )}
            {data.reminders.length > 0 && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            {data.entries.length > 0 && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </div>
        )}
      </Link>

      {/* Hover popover */}
      {open && data && hasActivity && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 min-w-[220px] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
            {format(day, "EEEE, MMM d")}
          </p>
          {data.tasks.length > 0 && (
            <div className="mb-1.5">
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                <CheckSquare className="h-2.5 w-2.5" /> {data.tasks.length} task{data.tasks.length > 1 ? "s" : ""}
              </p>
              <ul className="space-y-0.5">
                {data.tasks.slice(0, 3).map((t) => (
                  <li key={t.id} className="truncate text-zinc-700 dark:text-zinc-300">
                    {t.status === "done" ? "✓ " : "• "}
                    {t.title}
                  </li>
                ))}
                {data.tasks.length > 3 && <li className="text-zinc-400">+ {data.tasks.length - 3} more</li>}
              </ul>
            </div>
          )}
          {data.reminders.length > 0 && (
            <div className="mb-1.5">
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <Bell className="h-2.5 w-2.5" /> {data.reminders.length} reminder{data.reminders.length > 1 ? "s" : ""}
              </p>
              <ul className="space-y-0.5">
                {data.reminders.slice(0, 3).map((r) => (
                  <li key={r.id} className="truncate text-zinc-700 dark:text-zinc-300">
                    {format(parseISO(r.reminder_time), "HH:mm")} — {r.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.entries.length > 0 && (
            <div>
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                <FileText className="h-2.5 w-2.5" /> {data.entries.length} entr{data.entries.length > 1 ? "ies" : "y"}
              </p>
              <ul className="space-y-0.5">
                {data.entries.slice(0, 2).map((e) => (
                  <li key={e.id} className="truncate text-zinc-700 dark:text-zinc-300">
                    {e.productivity_score ? `⭐ ${e.productivity_score}/10 — ` : ""}
                    {e.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1.5 border-t border-zinc-100 pt-1.5 text-[10px] text-zinc-400 dark:border-zinc-800">
            Click to open calendar
          </p>
        </div>
      )}
    </div>
  );
}
