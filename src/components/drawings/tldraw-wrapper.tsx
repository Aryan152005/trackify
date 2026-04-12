"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

// Excalidraw is client-only and heavy — load it lazily on mount.
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-sm text-zinc-400 dark:bg-zinc-900">
        Loading canvas…
      </div>
    ),
  }
);

interface TldrawWrapperProps {
  initialData?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
  /** Remote updates to apply to the scene without re-mounting. */
  remoteUpdate?: { elements?: unknown[]; appState?: Record<string, unknown> } | null;
}

/**
 * Drawing canvas powered by Excalidraw (MIT-licensed, free, no commercial
 * license required). Exposes the same {initialData, onChange} API as the
 * previous tldraw wrapper so the calling page doesn't need changes.
 *
 * Old tldraw-format data in the DB will fail to parse here — the canvas
 * just opens blank and the user can re-draw.
 */
export function TldrawWrapper({ initialData, onChange, remoteUpdate }: TldrawWrapperProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  // Set while applying a remote peer's update — suppresses echo back to peers.
  const applyingRemoteRef = useRef(false);
  // Throttle: fire parent's onChange at most every FRAME_MS.
  const lastFireRef = useRef(0);
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ elements: unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> } | null>(null);
  // Figma-style approach: local rendering is always instant (Excalidraw handles
  // that internally). We only broadcast ~10 fps so network + JSON serialisation
  // don't block the drawing loop. Peers interpolate visually via their own render.
  const FRAME_MS = 100;
  const [parsedInitial, setParsedInitial] = useState<{
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  } | null>(null);

  // Parse initialData into the Excalidraw shape. If it's tldraw legacy or empty, start fresh.
  useEffect(() => {
    if (!initialData) {
      setParsedInitial({ elements: [], appState: { collaborators: new Map() } });
      return;
    }
    try {
      // Excalidraw serializes as { type, version, source, elements, appState, files }
      const maybeElements = (initialData as { elements?: unknown[] }).elements;
      if (Array.isArray(maybeElements)) {
        // Excalidraw expects appState.collaborators to be a Map; JSON round-trip
        // turns it into {} which breaks .forEach. Replace with an empty Map.
        const rawAppState = (initialData as { appState?: Record<string, unknown> }).appState ?? {};
        const safeAppState = { ...rawAppState, collaborators: new Map() };
        setParsedInitial({
          elements: maybeElements,
          appState: safeAppState,
          files: (initialData as { files?: Record<string, unknown> }).files ?? {},
        });
      } else {
        // Not Excalidraw format (likely legacy tldraw) — open blank
        setParsedInitial({ elements: [], appState: { collaborators: new Map() } });
      }
    } catch {
      setParsedInitial({ elements: [], appState: { collaborators: new Map() } });
    }
  }, [initialData]);

  // Throttled onChange — fires leading + trailing within each frame window.
  // Skips firing while we're applying a peer's update (prevents echo loop).
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (!onChange) return;
      if (applyingRemoteRef.current) return;

      const rawAppState = (appState as Record<string, unknown>) ?? {};
      const { collaborators: _collab, ...safeAppState } = rawAppState;
      void _collab;
      pendingRef.current = {
        elements: elements as unknown[],
        appState: safeAppState,
        files: files as Record<string, unknown>,
      };

      const now = Date.now();
      const elapsed = now - lastFireRef.current;
      const fire = () => {
        if (!pendingRef.current) return;
        lastFireRef.current = Date.now();
        const p = pendingRef.current;
        pendingRef.current = null;
        onChange({ type: "excalidraw", version: 2, source: "trackify", ...p });
      };
      if (elapsed >= FRAME_MS) {
        fire();
      } else if (!trailingRef.current) {
        trailingRef.current = setTimeout(() => {
          trailingRef.current = null;
          fire();
        }, FRAME_MS - elapsed);
      }
    },
    [onChange]
  );

  useEffect(() => {
    return () => {
      if (trailingRef.current) clearTimeout(trailingRef.current);
    };
  }, []);

  // Apply remote collaborator updates — ONLY elements, so each user keeps
  // their own tool, zoom, camera position, and selection. Suppress echo via
  // applyingRemoteRef so our onChange doesn't broadcast the peer's update back.
  useEffect(() => {
    if (!remoteUpdate || !apiRef.current) return;
    applyingRemoteRef.current = true;
    try {
      apiRef.current.updateScene({
        elements: (remoteUpdate.elements ?? []) as never,
      });
    } catch {
      // ignore — scene not ready
    }
    // Clear the flag after Excalidraw's internal onChange fires.
    setTimeout(() => { applyingRemoteRef.current = false; }, 50);
  }, [remoteUpdate]);

  if (!parsedInitial) {
    return (
      <div className="flex h-[calc(100dvh-10rem)] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-sm text-zinc-400">Preparing canvas…</span>
      </div>
    );
  }

  return (
    <div
      className="relative h-[calc(100dvh-10rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
      style={{ minHeight: 520 }}
    >
      <div className="absolute inset-0">
        <Excalidraw
          initialData={parsedInitial as never}
          onChange={handleChange}
          excalidrawAPI={(api) => { apiRef.current = api; }}
        />
      </div>
    </div>
  );
}
