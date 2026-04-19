"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quickCapture } from "@/lib/today/actions";

/**
 * Single-input capture. Types into one box, backend decides whether it's a
 * task or a reminder based on whether the text carries a time hint.
 *
 * Keep the UI boring on purpose — no mode switcher, no form, no selects.
 * Every extra control makes the "I just had a thought, write it down" flow
 * slower, which is the whole point of Today's home surface.
 */
export function QuickCapture() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = value.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const res = await quickCapture(text);
        toast.success(
          res.kind === "reminder"
            ? "Reminder set"
            : "Task added",
          {
            description: res.kind === "reminder"
              ? "You'll get a push at the scheduled time."
              : "Find it in Tasks to add detail or a due date.",
            icon: res.kind === "reminder"
              ? <Bell className="h-4 w-4 text-amber-500" />
              : <CheckCircle2 className="h-4 w-4 text-indigo-500" />,
          },
        );
        setValue("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What needs doing? (e.g. 'call supplier 3pm' or 'finish spec')"
        disabled={pending}
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        autoComplete="off"
      />
      <Button type="submit" disabled={pending || !value.trim()}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
        Add
      </Button>
    </form>
  );
}
