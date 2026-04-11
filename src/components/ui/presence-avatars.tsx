"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PresenceAvatarsProps {
  users: { userId: string; name: string; avatarUrl?: string | null }[];
  maxDisplay?: number;
}

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

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColorClass(userId: string): string {
  return AVATAR_COLORS[hashUserId(userId) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return (name.charAt(0) || "?").toUpperCase();
}

export function PresenceAvatars({
  users,
  maxDisplay = 5,
}: PresenceAvatarsProps) {
  const displayed = users.slice(0, maxDisplay);
  const overflow = users.length - maxDisplay;

  return (
    <div className="flex items-center -space-x-2">
      <AnimatePresence mode="popLayout">
        {displayed.map((user) => (
          <motion.div
            key={user.userId}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="relative"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                title={user.name}
                className="h-7 w-7 rounded-full border-2 border-white object-cover dark:border-zinc-900"
              />
            ) : (
              <div
                title={user.name}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white dark:border-zinc-900 ${getColorClass(user.userId)}`}
              >
                {getInitial(user.name)}
              </div>
            )}
          </motion.div>
        ))}

        {overflow > 0 && (
          <motion.div
            key="overflow"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <div
              title={`${overflow} more`}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-400 text-[10px] font-semibold text-white dark:border-zinc-900 dark:bg-zinc-600"
            >
              +{overflow}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
