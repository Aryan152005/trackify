"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { createClient } from "@/lib/supabase/client";
import { usePresence, type PresenceUser } from "./use-presence";

interface PresenceContextValue {
  onlineUsers: PresenceUser[];
  isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const workspaceId = useWorkspaceId();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      // Try to get profile info from user_profiles
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;

      setCurrentUser({
        id: user.id,
        name:
          profile?.name ??
          user.user_metadata?.full_name ??
          user.email ??
          "Unknown",
        avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      });
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const channelName = workspaceId ? `workspace-${workspaceId}` : "";
  const enabled = Boolean(workspaceId && currentUser);

  const onlineUsers = usePresence({
    channelName,
    userId: currentUser?.id ?? "",
    userName: currentUser?.name ?? "",
    avatarUrl: currentUser?.avatarUrl,
    enabled,
  });

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.some((u) => u.userId === userId),
    [onlineUsers]
  );

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function useWorkspacePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error(
      "useWorkspacePresence must be used within a PresenceProvider"
    );
  }
  return ctx;
}
