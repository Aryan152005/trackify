"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { usePresence, type PresenceUser } from "@/lib/realtime/use-presence";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getColor(id: string) {
  return AVATAR_COLORS[hashStr(id) % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// CollaborationPresenceAvatars
// ---------------------------------------------------------------------------

interface PresenceAvatarsProps {
  entityType: string;
  entityId: string;
  maxDisplay?: number;
}

export function CollaborationPresenceAvatars({
  entityType,
  entityId,
  maxDisplay = 5,
}: PresenceAvatarsProps) {
  const workspaceId = useWorkspaceId();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null>(null);

  // Get current user info
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      setCurrentUser({
        id: user.id,
        name: profile?.name ?? "Unknown",
        avatarUrl: profile?.avatar_url ?? null,
      });
    })();
  }, []);

  const channelName = "presence-" + entityType + "-" + entityId;

  const onlineUsers = usePresence({
    channelName,
    userId: currentUser?.id ?? "",
    userName: currentUser?.name ?? "",
    avatarUrl: currentUser?.avatarUrl,
    enabled: !!workspaceId && !!currentUser,
  });

  // Filter out current user from displayed avatars
  const otherUsers = onlineUsers.filter(
    (u) => u.userId !== currentUser?.id
  );

  if (otherUsers.length === 0) return null;

  const displayed = otherUsers.slice(0, maxDisplay);
  const overflow = otherUsers.length - maxDisplay;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {otherUsers.length} online
      </span>
      <div className="flex items-center -space-x-2">
        <AnimatePresence mode="popLayout">
          {displayed.map((user) => (
            <AvatarWithTooltip key={user.userId} user={user} />
          ))}

          {overflow > 0 && (
            <motion.div
              key="overflow"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <OverflowBadge
                count={overflow}
                users={otherUsers.slice(maxDisplay)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Backwards-compatible alias used by CollaborationToolbar */
export const PresenceAvatars = CollaborationPresenceAvatars;

// ---------------------------------------------------------------------------
// AvatarWithTooltip
// ---------------------------------------------------------------------------

function AvatarWithTooltip({ user }: { user: PresenceUser }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="relative focus:outline-none"
          title={user.name}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-7 w-7 rounded-full border-2 border-white object-cover dark:border-zinc-900"
            />
          ) : (
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-zinc-900",
                getColor(user.userId)
              )}
            >
              {(user.name.charAt(0) || "?").toUpperCase()}
            </div>
          )}
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />
        </motion.button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={4}
          className="z-50 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-md dark:border-zinc-700 dark:bg-zinc-800"
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {user.name}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Online now
          </p>
          <Popover.Arrow className="fill-white dark:fill-zinc-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// OverflowBadge
// ---------------------------------------------------------------------------

function OverflowBadge({
  count,
  users,
}: {
  count: number;
  users: PresenceUser[];
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-400 text-[10px] font-semibold text-white dark:border-zinc-900 dark:bg-zinc-600"
          title={count + " more users"}
        >
          +{count}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={4}
          className="z-50 rounded-lg border border-zinc-200 bg-white p-2 shadow-md dark:border-zinc-700 dark:bg-zinc-800"
        >
          <div className="space-y-1">
            {users.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-2 rounded px-2 py-1"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white",
                      getColor(user.userId)
                    )}
                  >
                    {(user.name.charAt(0) || "?").toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {user.name}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
          <Popover.Arrow className="fill-white dark:fill-zinc-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
