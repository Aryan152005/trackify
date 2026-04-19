"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMinutes, addHours } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { istLocalToUtcISO, utcISOToIstLocalInput, istDateKey } from "@/lib/utils/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

export default function NewReminderPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("daily");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!reminderTime) {
      toast.error("Reminder time is required");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { error: insertError } = await supabase.from("reminders").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim() || null,
        // Interpret the input as IST (not browser-local) so the stored UTC
        // instant matches the wall-clock time the user typed, regardless
        // of the device's timezone.
        reminder_time: istLocalToUtcISO(reminderTime),
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
      });

      if (insertError) {
        toast.error(insertError.message);
        return;
      }

      toast.success("Reminder created");
      router.push("/reminders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="New Reminder"
        description="Set a reminder for an important task or event"
        backHref="/reminders"
        backLabel="Back to Reminders"
      />

      <Card>
        <CardHeader>
          <CardTitle>Reminder Details</CardTitle>
          <CardDescription>Fill in the information for your reminder</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="reminderTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Reminder Time *
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  // All chips produce IST wall-clock values so the stored
                  // instant matches what the user sees, regardless of device TZ.
                  const setTo = (d: Date) => setReminderTime(utcISOToIstLocalInput(d.toISOString()));
                  // "IST today" as a YYYY-MM-DD string, and a helper that
                  // builds tomorrow (or next Monday) at 9 AM IST as an instant.
                  const todayIst = istDateKey(new Date());
                  const istAt9 = (daysAhead: number) => {
                    // Start from today 00:00 IST, shift by daysAhead, pick 9am.
                    const base = new Date(`${todayIst}T09:00:00+05:30`);
                    return new Date(base.getTime() + daysAhead * 24 * 3600 * 1000);
                  };
                  // Day-of-week in IST (0 = Sun ... 6 = Sat). Computing via
                  // toLocaleString gives us the IST calendar day regardless
                  // of the browser's own timezone.
                  const istDow = new Date(
                    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                  ).getDay();
                  const daysToMon = ((1 - istDow + 7) % 7) || 7;
                  const chips: { label: string; fn: () => Date }[] = [
                    { label: "+15 min", fn: () => addMinutes(new Date(), 15) },
                    { label: "+1 hour", fn: () => addHours(new Date(), 1) },
                    { label: "+3 hours", fn: () => addHours(new Date(), 3) },
                    { label: "Tomorrow 9 AM IST", fn: () => istAt9(1) },
                    { label: "Next Monday 9 AM IST", fn: () => istAt9(daysToMon) },
                  ];
                  return chips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      disabled={loading}
                      onClick={() => setTo(c.fn())}
                      className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
                    >
                      {c.label}
                    </button>
                  ));
                })()}
              </div>
              <input
                id="reminderTime"
                type="datetime-local"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isRecurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                disabled={loading}
              />
              <label htmlFor="isRecurring" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Recurring reminder
              </label>
            </div>

            {isRecurring && (
              <div>
                <label htmlFor="recurrencePattern" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Recurrence Pattern
                </label>
                <div className="mt-2">
                  <Select value={recurrencePattern} onValueChange={(v) => setRecurrencePattern(v)} disabled={loading}>
                    <SelectTrigger id="recurrencePattern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Reminder"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
