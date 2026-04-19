"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateColumn } from "@/lib/boards/actions";

const COLUMN_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#64748b", // slate
];

interface Props {
  column: { id: string; name: string; color: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string, patch: { name: string; color: string }) => void;
}

export function ColumnEditDialog({ column, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column?.color ?? COLUMN_COLORS[0]);
  const [pending, startTransition] = useTransition();

  // Reset form when the column being edited changes
  useEffect(() => {
    if (column) {
      setName(column.name);
      setColor(column.color);
    }
  }, [column?.id, column?.name, column?.color, column]);

  function handleSave() {
    if (!column) return;
    if (!name.trim()) {
      toast.error("Column name is required");
      return;
    }
    startTransition(async () => {
      try {
        await updateColumn(column.id, { name: name.trim(), color });
        onSaved(column.id, { name: name.trim(), color });
        toast.success("Column updated");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
          <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Edit column
          </Dialog.Title>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      color === c
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
