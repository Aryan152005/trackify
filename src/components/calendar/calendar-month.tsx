"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";

export interface CalendarEventItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color: string | null;
  type: "event" | "task" | "reminder";
}

interface CalendarMonthProps {
  year: number;
  month: number;
  events: CalendarEventItem[];
  onEventClick: (id: string) => void;
  onDateClick: (date: Date) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MAX_VISIBLE_EVENTS = 3;

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
};

function eventColorClass(color: string | null): string {
  if (!color) return "bg-indigo-500";
  return COLOR_MAP[color] ?? "bg-indigo-500";
}

export function CalendarMonth({
  year,
  month,
  events,
  onEventClick,
  onDateClick,
}: CalendarMonthProps) {
  const monthDate = new Date(year, month, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function eventsForDay(day: Date) {
    return events.filter((e) => {
      const start = parseISO(e.start_time);
      return isSameDay(start, day);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, monthDate);
          const today = isToday(day);
          const dayEvents = eventsForDay(day);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={idx}
              onClick={() => onDateClick(day)}
              className={cn(
                "min-h-[90px] cursor-pointer border-b border-r border-zinc-200 p-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40",
                !inMonth && "bg-zinc-50/50 dark:bg-zinc-900/50"
              )}
            >
              {/* Date number */}
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    today
                      ? "bg-indigo-600 text-white"
                      : inMonth
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400 dark:text-zinc-600"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Event pills */}
              <div className="space-y-0.5">
                {visibleEvents.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(evt.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight text-white transition-opacity hover:opacity-80",
                      eventColorClass(evt.color)
                    )}
                    title={evt.title}
                  >
                    <span className="truncate">{evt.title}</span>
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="block px-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
