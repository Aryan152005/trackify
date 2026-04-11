"use client";

import { useEffect, useRef, useState } from "react";
import {
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  format,
  parseISO,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEventItem } from "./calendar-month";

interface CalendarWeekProps {
  year: number;
  month: number;
  weekStart: Date;
  events: CalendarEventItem[];
  onEventClick: (id: string) => void;
  onDateClick: (date: Date) => void;
}

const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 60; // px per hour

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-500/80 border-indigo-600",
  blue: "bg-blue-500/80 border-blue-600",
  green: "bg-green-500/80 border-green-600",
  red: "bg-red-500/80 border-red-600",
  orange: "bg-orange-500/80 border-orange-600",
  purple: "bg-purple-500/80 border-purple-600",
  pink: "bg-pink-500/80 border-pink-600",
  yellow: "bg-yellow-500/80 border-yellow-600",
  teal: "bg-teal-500/80 border-teal-600",
};

function eventColorClass(color: string | null): string {
  if (!color) return "bg-indigo-500/80 border-indigo-600";
  return COLOR_MAP[color] ?? "bg-indigo-500/80 border-indigo-600";
}

function isAllDay(evt: CalendarEventItem): boolean {
  const start = parseISO(evt.start_time);
  const end = parseISO(evt.end_time);
  return differenceInMinutes(end, start) >= 1440;
}

export function CalendarWeek({
  weekStart,
  events,
  onEventClick,
  onDateClick,
}: CalendarWeekProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Update current time indicator every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to 8am on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = HOUR_HEIGHT; // 1 hour past START_HOUR = 8am
    }
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDayEvents = events.filter(isAllDay);
  const timedEvents = events.filter((e) => !isAllDay(e));

  function eventsForDay(day: Date, list: CalendarEventItem[]) {
    return list.filter((e) => isSameDay(parseISO(e.start_time), day));
  }

  function eventPosition(evt: CalendarEventItem) {
    const start = parseISO(evt.start_time);
    const end = parseISO(evt.end_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
    return { top, height };
  }

  // Current time indicator position
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const todayIndex = weekDays.findIndex((d) => isToday(d));

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* Header with day names */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
        <div className="border-r border-zinc-200 dark:border-zinc-800" />
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              "border-r border-zinc-200 px-2 py-2 text-center dark:border-zinc-800",
              i === 6 && "border-r-0"
            )}
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day)
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-900 dark:text-zinc-100"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events banner */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-center border-r border-zinc-200 px-1 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            All day
          </div>
          {weekDays.map((day, i) => {
            const dayAllDay = eventsForDay(day, allDayEvents);
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[28px] space-y-0.5 border-r border-zinc-200 p-0.5 dark:border-zinc-800",
                  i === 6 && "border-r-0"
                )}
              >
                {dayAllDay.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => onEventClick(evt.id)}
                    className={cn(
                      "w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white",
                      eventColorClass(evt.color).split(" ")[0]
                    )}
                  >
                    {evt.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div
        ref={containerRef}
        className="relative max-h-[600px] overflow-y-auto"
      >
        <div
          className="relative grid grid-cols-[56px_repeat(7,1fr)]"
          style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
        >
          {/* Hour labels column */}
          <div className="relative border-r border-zinc-200 dark:border-zinc-800">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-zinc-400 dark:text-zinc-500"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {format(setMinutes(setHours(new Date(), START_HOUR + i), 0), "ha")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, colIdx) => {
            const dayTimedEvents = eventsForDay(day, timedEvents);
            return (
              <div
                key={colIdx}
                className={cn(
                  "relative border-r border-zinc-200 dark:border-zinc-800",
                  colIdx === 6 && "border-r-0"
                )}
                onClick={() => onDateClick(day)}
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800/60"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayTimedEvents.map((evt) => {
                  const { top, height } = eventPosition(evt);
                  return (
                    <button
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(evt.id);
                      }}
                      className={cn(
                        "absolute left-0.5 right-0.5 overflow-hidden rounded border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight text-white transition-opacity hover:opacity-90",
                        eventColorClass(evt.color)
                      )}
                      style={{ top, height, minHeight: 20 }}
                      title={evt.title}
                    >
                      <span className="font-medium">{evt.title}</span>
                      <br />
                      <span className="opacity-80">
                        {format(parseISO(evt.start_time), "h:mma")}
                      </span>
                    </button>
                  );
                })}

                {/* Current time indicator */}
                {isToday(day) && nowTop >= 0 && nowTop <= TOTAL_HOURS * HOUR_HEIGHT && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <div className="h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500" />
                    <div className="h-[2px] flex-1 bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
