"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CursorInfo {
  userId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  lastActive: number; // timestamp
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURSOR_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#14b8a6", // teal
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCursorColor(userId: string): string {
  return CURSOR_COLORS[hashUserId(userId) % CURSOR_COLORS.length];
}

/** Auto-hide cursors after this many milliseconds of inactivity */
const INACTIVITY_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// CursorOverlay
// ---------------------------------------------------------------------------

interface CursorOverlayProps {
  entityType: string;
  entityId: string;
}

export function CursorOverlay({ entityType, entityId }: CursorOverlayProps) {
  const workspaceId = useWorkspaceId();
  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current user
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // Subscribe to presence channel for cursor positions
  useEffect(() => {
    if (!workspaceId || !currentUserId) return;

    const supabase = createClient();
    const channelName = "cursors-" + entityType + "-" + entityId;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          name: string;
          x: number;
          y: number;
        }>();
        const updated = new Map<string, CursorInfo>();

        for (const key of Object.keys(state)) {
          const presences = state[key];
          for (const p of presences) {
            if (p.userId === currentUserId) continue; // Skip own cursor
            updated.set(p.userId, {
              userId: p.userId,
              name: p.name,
              x: p.x,
              y: p.y,
              color: getCursorColor(p.userId),
              lastActive: Date.now(),
            });
          }
        }

        setCursors(updated);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // We will track position on mouse move
          await channel.track({
            userId: currentUserId,
            name: "",
            x: 0,
            y: 0,
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, entityType, entityId, currentUserId]);

  // Track mouse movement and broadcast position
  useEffect(() => {
    if (!channelRef.current || !currentUserId) return;

    let rafId: number;
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };

    // Throttle broadcast to ~30fps
    const broadcastLoop = () => {
      if (channelRef.current) {
        channelRef.current.track({
          userId: currentUserId,
          name: "", // Will be populated from user profile
          x: lastX,
          y: lastY,
        });
      }
      rafId = requestAnimationFrame(() => {
        setTimeout(broadcastLoop, 33);
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    broadcastLoop();

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [currentUserId]);

  // Prune inactive cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const updated = new Map(prev);
        let changed = false;
        for (const [key, cursor] of updated) {
          if (now - cursor.lastActive > INACTIVITY_TIMEOUT) {
            updated.delete(key);
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const cursorArray = Array.from(cursors.values());

  if (cursorArray.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    >
      <AnimatePresence>
        {cursorArray.map((cursor) => (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: cursor.x,
              y: cursor.y,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              x: { type: "spring", stiffness: 200, damping: 25 },
              y: { type: "spring", stiffness: 200, damping: 25 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            className="absolute left-0 top-0"
            style={{ willChange: "transform" }}
          >
            {/* Cursor SVG */}
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0.928711 0.5L15.0713 11.0714H7.07129L4.07129 19.0714L0.928711 0.5Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>

            {/* Name label */}
            {cursor.name && (
              <div
                className="ml-3 -mt-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
