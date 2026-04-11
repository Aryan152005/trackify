"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  color?: string | null;
  location?: string | null;
}

export interface EventFormData {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  location?: string;
}

interface EventFormProps {
  event?: CalendarEvent;
  defaultDate?: Date;
  onSubmit: (data: EventFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

const PRESET_COLORS = [
  { name: "indigo", class: "bg-indigo-500" },
  { name: "blue", class: "bg-blue-500" },
  { name: "green", class: "bg-green-500" },
  { name: "red", class: "bg-red-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "pink", class: "bg-pink-500" },
  { name: "yellow", class: "bg-yellow-500" },
  { name: "teal", class: "bg-teal-500" },
];

function toLocalDatetime(iso: string): string {
  try {
    return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function defaultStartTime(date?: Date): string {
  const d = date ?? new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function defaultEndTime(date?: Date): string {
  const d = date ?? new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function EventForm({
  event,
  defaultDate,
  onSubmit,
  onDelete,
  onClose,
}: EventFormProps) {
  const isEditing = !!event;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startTime, setStartTime] = useState(
    event ? toLocalDatetime(event.start_time) : defaultStartTime(defaultDate)
  );
  const [endTime, setEndTime] = useState(
    event ? toLocalDatetime(event.end_time) : defaultEndTime(defaultDate)
  );
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [color, setColor] = useState(event?.color ?? "indigo");
  const [location, setLocation] = useState(event?.location ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        all_day: allDay,
        color,
        location: location.trim() || undefined,
      });
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event || !onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setIsDeleting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500";

  const labelClass =
    "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {isEditing ? "Edit Event" : "New Event"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className={labelClass}>Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className={cn(inputClass, "mt-1")}
                autoFocus
              />
            </div>

            {/* All day toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="all-day"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700"
              />
              <label
                htmlFor="all-day"
                className="text-sm text-zinc-700 dark:text-zinc-300"
              >
                All day
              </label>
            </div>

            {/* Date / time inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start</label>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  required
                  value={allDay ? startTime.slice(0, 10) : startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </div>
              <div>
                <label className={labelClass}>End</label>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  required
                  value={allDay ? endTime.slice(0, 10) : endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional location"
                className={cn(inputClass, "mt-1")}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className={cn(inputClass, "mt-1 resize-none")}
              />
            </div>

            {/* Color picker */}
            <div>
              <label className={labelClass}>Color</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      c.class,
                      color === c.name
                        ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900"
                        : "opacity-60 hover:opacity-100"
                    )}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {isEditing && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={handleDelete}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !title.trim()}>
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
