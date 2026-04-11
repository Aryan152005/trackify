"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Bell } from "lucide-react";
import type { Reminder } from "@/lib/types/database";

interface RemindersWidgetProps {
  reminders: Pick<Reminder, "id" | "title" | "reminder_time" | "is_completed">[];
}

export function RemindersWidget({ reminders }: RemindersWidgetProps) {
  if (reminders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Reminders
          </CardTitle>
          <CardDescription>No upcoming reminders</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/reminders">
            <Button variant="outline" className="w-full">
              Add Reminder
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Upcoming Reminders
        </CardTitle>
        <CardDescription>{reminders.length} upcoming</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const reminderDate = parseISO(reminder.reminder_time);
            const isToday = format(reminderDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            return (
              <div
                key={reminder.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{reminder.title}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {isToday ? "Today" : format(reminderDate, "MMM d")} at {format(reminderDate, "h:mm a")}
                </p>
              </div>
            );
          })}
        </div>
        <Link href="/reminders" className="mt-4 block">
          <Button variant="outline" className="w-full">
            View All
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
