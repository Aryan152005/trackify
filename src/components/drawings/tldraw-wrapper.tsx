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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (!onChange) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Don't persist collaborators (runtime Map, serializes badly).
        const rawAppState = (appState as Record<string, unknown>) ?? {};
        const { collaborators: _collab, ...safeAppState } = rawAppState;
        void _collab;
        onChange({
          type: "excalidraw",
          version: 2,
          source: "trackify",
          elements: elements as unknown[],
          appState: safeAppState,
          files: files as Record<string, unknown>,
        });
      }, 1000);
    },
    [onChange]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Apply remote collaborator updates into the live scene.
  useEffect(() => {
    if (!remoteUpdate || !apiRef.current) return;
    try {
      apiRef.current.updateScene({
        elements: (remoteUpdate.elements ?? []) as never,
        appState: { ...(remoteUpdate.appState ?? {}), collaborators: new Map() } as never,
      });
    } catch {
      // ignore — scene not ready
    }
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
