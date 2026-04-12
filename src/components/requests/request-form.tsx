"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Send, X } from "lucide-react";
import type { RequestType } from "@/lib/types/notification";

interface RequestFormProps {
  workspaceId: string;
  members: { id: string; name: string; avatar_url: string | null }[];
  onSubmit: (data: {
    to_user_id: string;
    type: RequestType;
    title: string;
    description?: string;
    due_date?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "review", label: "Review" },
  { value: "approval", label: "Approval" },
  { value: "info", label: "Info" },
  { value: "nudge", label: "Nudge" },
  { value: "custom", label: "Custom" },
];

const inputClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export function RequestForm({
  workspaceId,
  members,
  onSubmit,
  onCancel,
}: RequestFormProps) {
  const [toUserId, setToUserId] = useState("");
  const [type, setType] = useState<RequestType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId || !title.trim()) {
      setError("Recipient and title are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        to_user_id: toUserId,
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          New Request
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Recipient <span className="text-red-500">*</span>
            </label>
            {members.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
                <p className="text-zinc-700 dark:text-zinc-300">
                  No teammates in this workspace yet.
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Invite someone first —{" "}
                  <a
                    href="/workspace/members"
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    go to Team Members →
                  </a>
                </p>
              </div>
            ) : (
              <Select value={toUserId} onValueChange={(v) => setToUserId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select from ${members.length} teammate${members.length === 1 ? "" : "s"}...`} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type
            </label>
            <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need?"
              className={inputClasses}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details (optional)"
              rows={3}
              className={inputClasses + " resize-none"}
            />
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClasses}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || members.length === 0}>
              {submitting ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {submitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
