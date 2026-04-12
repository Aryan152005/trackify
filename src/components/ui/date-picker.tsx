"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import "react-day-picker/style.css";

export interface DatePickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  min?: string;
  required?: boolean;
  name?: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  disabled,
  min,
  required,
  name,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;

  const label = selected ? format(selected, "MMM d, yyyy") : "";

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={value ?? ""} required={required} />
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-required={required}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
          >
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span className={label ? "" : "text-zinc-400 dark:text-zinc-500"}>
                {label || placeholder}
              </span>
            </span>
            {label && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onChange(undefined);
                  }
                }}
                className="ml-2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (d) {
                  onChange(toISO(d));
                  setOpen(false);
                } else {
                  onChange(undefined);
                }
              }}
              disabled={minDate ? { before: minDate } : undefined}
              showOutsideDays
              classNames={{
                root: "rdp text-sm text-zinc-800 dark:text-zinc-100",
                month_caption: "flex justify-center py-1 font-medium",
                nav: "flex items-center gap-1",
                button_previous:
                  "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800",
                button_next:
                  "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800",
                month_grid: "mt-2 border-collapse",
                weekday:
                  "text-xs font-medium text-zinc-500 dark:text-zinc-400 w-9 h-8",
                day: "p-0",
                day_button:
                  "h-9 w-9 rounded-md text-sm hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300",
                selected:
                  "[&>button]:bg-indigo-600 [&>button]:text-white [&>button]:hover:bg-indigo-700 [&>button]:hover:text-white",
                today: "[&>button]:font-semibold [&>button]:text-indigo-600 dark:[&>button]:text-indigo-400",
                outside: "text-zinc-400 dark:text-zinc-600",
                disabled: "opacity-40 [&>button]:cursor-not-allowed",
              }}
            />
            <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                }}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(toISO(new Date()));
                  setOpen(false);
                }}
                className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              >
                Today
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
