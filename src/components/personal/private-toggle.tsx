"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { togglePrivate } from "@/lib/personal/actions";
import { toast } from "sonner";

interface PrivateToggleProps {
  entityType: string;
  entityId: string;
  isPrivate: boolean;
  onToggle?: (val: boolean) => void;
}

export function PrivateToggle({
  entityType,
  entityId,
  isPrivate,
  onToggle,
}: PrivateToggleProps) {
  const [localPrivate, setLocalPrivate] = useState(isPrivate);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const newValue = !localPrivate;
    startTransition(async () => {
      try {
        await togglePrivate(entityType, entityId, newValue);
        setLocalPrivate(newValue);
        onToggle?.(newValue);
        toast.success(
          newValue
            ? "Item is now private. Only you can see it."
            : "Item is now visible to workspace members."
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update privacy"
        );
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className="gap-1.5 text-xs"
      title={localPrivate ? "Private — only you can see this" : "Visible to workspace"}
    >
      {localPrivate ? (
        <>
          <Lock className="h-3.5 w-3.5 text-amber-500" />
          <span className="hidden sm:inline">Private</span>
        </>
      ) : (
        <>
          <Unlock className="h-3.5 w-3.5 text-zinc-400" />
          <span className="hidden sm:inline">Public</span>
        </>
      )}
    </Button>
  );
}
