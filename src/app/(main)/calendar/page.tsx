"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarMonth, type CalendarEventItem } from "@/components/calendar/calendar-month";
import { CalendarWeek } from "@/components/calendar/calendar-week";
import {
  EventForm,
  type EventFormData,
  type CalendarEvent,
} from "@/components/calendar/event-form";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  getAggregatedCalendar,
} from "@/lib/calendar/actions";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week";

export default function CalendarPage() {
  const workspaceId = useWorkspaceId();
  const router = useRouter();

  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  // Computed visible range
  const visibleRange = useCallback(() => {
    if (view === "month") {
      const mStart = startOfMonth(currentDate);
      const mEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(mStart, { weekStartsOn: 0 }),
        end: endOfWeek(mEnd, { weekStartsOn: 0 }),
      };
    }
    const wStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return {
      start: wStart,
      end: endOfWeek(wStart, { weekStartsOn: 0 }),
    };
  }, [view, currentDate]);

  // Fetch events
  const loadEvents = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const { start, end } = visibleRange();
      const data = await getAggregatedCalendar(
        workspaceId,
        start.toISOString(),
        end.toISOString()
      );
      setEvents(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, visibleRange]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigation
  function goToday() {
    setCurrentDate(new Date());
  }
  function goPrev() {
    setCurrentDate((d) =>
      view === "month" ? subMonths(d, 1) : subWeeks(d, 1)
    );
  }
  function goNext() {
    setCurrentDate((d) =>
      view === "month" ? addMonths(d, 1) : addWeeks(d, 1)
    );
  }

  // Title
  const title =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d, yyyy")}`;

  // Event handlers
  function handleDateClick(date: Date) {
    setEditingEvent(undefined);
    setDefaultDate(date);
    setShowForm(true);
  }

  async function handleEventClick(id: string) {
    const evt = events.find((e) => e.id === id);
    if (!evt) return;

    // Tasks and reminders live in their own tables — editing them in the event
    // dialog would be lossy (due_date vs start/end etc). Route to their detail
    // pages instead. Only true calendar_events open the inline form.
    if (evt.type === "task") {
      router.push(`/tasks/${evt.id}`);
      return;
    }
    if (evt.type === "reminder") {
      router.push(`/reminders`);
      return;
    }

    // Calendar event: fetch the full record so description/location/all_day
    // are preserved in the edit form (the tile row doesn't carry them).
    try {
      const full = await getEventById(evt.id);
      setEditingEvent({
        id: full.id as string,
        title: full.title as string,
        description: (full.description as string) ?? null,
        start_time: full.start_time as string,
        end_time: full.end_time as string,
        all_day: (full.all_day as boolean) ?? false,
        color: (full.color as string) ?? null,
        location: (full.location as string) ?? null,
      });
      setDefaultDate(undefined);
      setShowForm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open event");
    }
  }

  function handleAddEvent() {
    setEditingEvent(undefined);
    setDefaultDate(new Date());
    setShowForm(true);
  }

  async function handleSubmit(data: EventFormData) {
    if (!workspaceId) return;
    if (editingEvent) {
      await updateEvent(editingEvent.id, data);
    } else {
      await createEvent(workspaceId, data);
    }
    await loadEvents();
  }

  async function handleDelete(id: string) {
    await deleteEvent(id);
    await loadEvents();
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Calendar"
          actions={
            <Button onClick={handleAddEvent}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Event
            </Button>
          }
        />

        {/* Toolbar */}
        <Card className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
            </div>

            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setView("month")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "month"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                )}
              >
                Month
              </button>
              <button
                onClick={() => setView("week")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "week"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                )}
              >
                Week
              </button>
            </div>
          </div>
        </Card>

        {/* Calendar view */}
        {isLoading && !events.length ? (
          <Card className="flex h-96 items-center justify-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading calendar...
            </p>
          </Card>
        ) : view === "month" ? (
          <CalendarMonth
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            events={events}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        ) : (
          <CalendarWeek
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            weekStart={weekStart}
            events={events}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        )}

        {/* Event form modal */}
        {showForm && (
          <EventForm
            event={editingEvent}
            defaultDate={defaultDate}
            onSubmit={handleSubmit}
            onDelete={editingEvent ? handleDelete : undefined}
            onClose={() => {
              setShowForm(false);
              setEditingEvent(undefined);
              setDefaultDate(undefined);
            }}
          />
        )}
      </div>
    </AnimatedPage>
  );
}
