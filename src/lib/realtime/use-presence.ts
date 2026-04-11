"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  currentPage?: string;
  lastSeen: string;
}

interface UsePresenceOptions {
  channelName: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  currentPage?: string;
  enabled?: boolean;
}

export function usePresence(options: UsePresenceOptions): PresenceUser[] {
  const {
    channelName,
    userId,
    userName,
    avatarUrl,
    currentPage,
    enabled = true,
  } = options;

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    const supabase = createClient();
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        const seen = new Set<string>();

        for (const key of Object.keys(state)) {
          const presences = state[key];
          for (const presence of presences) {
            // Deduplicate by userId — keep the most recent entry
            if (!seen.has(presence.userId)) {
              seen.add(presence.userId);
              users.push({
                userId: presence.userId,
                name: presence.name,
                avatarUrl: presence.avatarUrl,
                currentPage: presence.currentPage,
                lastSeen: presence.lastSeen,
              });
            }
          }
        }

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            name: userName,
            avatarUrl: avatarUrl ?? null,
            currentPage: currentPage ?? undefined,
            lastSeen: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, userId, userName, avatarUrl, currentPage, enabled]);

  return onlineUsers;
}
