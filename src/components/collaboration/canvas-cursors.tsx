"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SupabaseYjsProvider } from "@/lib/collab/supabase-yjs-provider";

interface PeerCursor {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  sceneX: number;
  sceneY: number;
}

interface CanvasCursorsProps {
  provider: SupabaseYjsProvider;
  /** Current user's id — we filter them out of the rendered cursors. */
  selfUserId: string | null;
  /**
   * Returns the current canvas transform so we can map scene-space cursor
   * positions back to screen pixels for THIS viewer.
   */
  getTransform: () => { zoom: number; offsetX: number; offsetY: number };
}

/**
 * Renders remote collaborators' cursors on top of a pan/zoom canvas.
 *
 * Unlike the global CursorOverlay (which reads clientX/clientY directly),
 * this component reads cursor positions in *scene coordinates* from Yjs
 * awareness and projects them to screen coordinates through the current
 * canvas transform — so a peer panning their view doesn't move cursors for
 * everyone else.
 */
export function CanvasCursors({ provider, selfUserId, getTransform }: CanvasCursorsProps) {
  const [peers, setPeers] = useState<PeerCursor[]>([]);

  useEffect(() => {
    const awareness = provider.awareness;
    const read = () => {
      const list: PeerCursor[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const uid = state.userId as string | undefined;
        if (!uid || uid === selfUserId) return;
        const cursor = state.cursor as
          | { x: number; y: number; space?: string }
          | undefined;
        if (!cursor) return;
        list.push({
          clientId,
          userId: uid,
          name: (state.name as string) ?? "Collaborator",
          color: (state.color as string) ?? "#6366f1",
          sceneX: cursor.x,
          sceneY: cursor.y,
        });
      });
      setPeers(list);
    };
    read();
    awareness.on("change", read);
    return () => awareness.off("change", read);
  }, [provider, selfUserId]);

  // Re-project every frame while peers are visible so pan/zoom in OUR view
  // moves the cursors correctly. Cheap — only runs when peers exist.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (peers.length === 0) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 60_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [peers.length]);

  if (peers.length === 0) return null;
  const t = getTransform();

  return (
    <div className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
      <AnimatePresence>
        {peers.map((p) => {
          // scene -> screen:  screenX = (sceneX + offsetX) * zoom
          const screenX = (p.sceneX + t.offsetX) * t.zoom;
          const screenY = (p.sceneY + t.offsetY) * t.zoom;
          return (
            <motion.div
              key={p.clientId}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1, x: screenX, y: screenY }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30, mass: 0.5 },
                y: { type: "spring", stiffness: 300, damping: 30, mass: 0.5 },
                opacity: { duration: 0.15 },
              }}
              className="absolute left-0 top-0"
              style={{ willChange: "transform" }}
            >
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.928711 0.5L15.0713 11.0714H7.07129L4.07129 19.0714L0.928711 0.5Z"
                  fill={p.color}
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>
              {p.name && (
                <div
                  className="ml-3 -mt-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
