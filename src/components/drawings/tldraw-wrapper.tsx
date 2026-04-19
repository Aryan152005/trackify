"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import * as Y from "yjs";
import { useYjsDoc } from "@/lib/collab/use-yjs-doc";
import { CanvasCursors } from "@/components/collaboration/canvas-cursors";

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
  /** Persisted drawing id — drives the Yjs channel and snapshot column. */
  drawingId: string;
  /** Legacy JSON seed. Used once if the Y.Doc has no saved state yet. */
  initialData?: Record<string, unknown>;
  /** Called with the derived JSON scene whenever elements change — used to
   *  keep the legacy `data` column populated for exports. */
  onChange?: (data: Record<string, unknown>) => void;
}

type ExElement = { id: string; version: number } & Record<string, unknown>;

/**
 * Drawing canvas powered by Excalidraw + Yjs.
 *
 * How collab works now:
 *   - We keep a `Y.Map<string, ExElement>` keyed by element id.
 *   - On local Excalidraw change we transact: upsert every element whose
 *     `version` advanced, delete keys no longer in the scene.
 *   - On remote Y.Map changes we reapply the full element array. Excalidraw's
 *     `updateScene` is diffing-aware so this is fine.
 *   - Peer updates carry an origin tag so our observer doesn't re-broadcast.
 *   - Each user keeps their own tool, zoom, camera — `appState.collaborators`
 *     is locally reset to an empty Map on every mount (Excalidraw quirk).
 *
 * Persistence:
 *   - Yjs binary state goes into `drawings.yjs_state` via the provider.
 *   - The legacy `drawings.data` JSON is still written by the caller via the
 *     `onChange` we still fire — that keeps exports and old viewers working.
 */
export function TldrawWrapper({ drawingId, initialData, onChange }: TldrawWrapperProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const { doc, provider, ready, self } = useYjsDoc({
    entity: "drawings",
    id: drawingId,
    enabled: !!drawingId,
  });

  // Y.Map<id, ExElement>. Lazily created whenever `doc` is ready.
  const elementsMap = useMemo(() => doc?.getMap<ExElement>("elements") ?? null, [doc]);

  // Snapshot of versions we last wrote to Y — used to skip unchanged elements.
  const lastSentVersionsRef = useRef<Map<string, number>>(new Map());

  // When `true`, our onChange handler treats the next Excalidraw change as
  // externally-driven (a peer update being applied) and skips writing to Y.
  const applyingRemoteRef = useRef(false);

  // Parse `initialData` once so we can seed the Y.Map if it's empty.
  const seedElements = useMemo<ExElement[]>(() => {
    if (!initialData) return [];
    const maybe = (initialData as { elements?: unknown[] }).elements;
    return Array.isArray(maybe) ? (maybe as ExElement[]) : [];
  }, [initialData]);

  // Local state for what Excalidraw should render. Driven by Y.Map observe.
  const [renderedElements, setRenderedElements] = useState<ExElement[] | null>(null);

  // --------------------------------------------------------------------------
  // Seed the Y.Map from legacy JSON the first time we load into an empty doc.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!ready || !elementsMap || !doc) return;
    if (elementsMap.size === 0 && seedElements.length > 0) {
      doc.transact(() => {
        for (const el of seedElements) elementsMap.set(el.id, el);
      }, "seed");
    }
    // Render whatever the doc now contains.
    setRenderedElements(readElements(elementsMap));
  }, [ready, elementsMap, doc, seedElements]);

  // --------------------------------------------------------------------------
  // Subscribe to Y.Map changes — when peers (or our own transact) mutate it,
  // re-render Excalidraw with the merged element list.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!elementsMap) return;
    const listener = () => {
      const arr = readElements(elementsMap);
      setRenderedElements(arr);
      // Push into Excalidraw without causing our own echo.
      if (apiRef.current) {
        applyingRemoteRef.current = true;
        try {
          apiRef.current.updateScene({ elements: arr as never });
        } catch {
          /* scene not ready yet */
        }
        // Release the flag on next microtask — Excalidraw will have fired
        // its onChange by then and we want it ignored.
        setTimeout(() => { applyingRemoteRef.current = false; }, 0);
      }
      // Refresh our legacy JSON writer.
      onChange?.({ type: "excalidraw", version: 2, source: "trackify", elements: arr });
    };
    elementsMap.observe(listener);
    return () => elementsMap.unobserve(listener);
  }, [elementsMap, onChange]);

  // --------------------------------------------------------------------------
  // Local -> Y: on Excalidraw change, diff versions and upsert into Y.Map.
  // --------------------------------------------------------------------------
  const handleChange = useCallback(
    (elements: readonly unknown[]) => {
      if (!doc || !elementsMap) return;
      if (applyingRemoteRef.current) return; // This tick was a remote apply.

      const arr = elements as ExElement[];
      const nowVersions = new Map<string, number>();
      for (const el of arr) nowVersions.set(el.id, el.version);

      // Collect changes.
      const toUpsert: ExElement[] = [];
      for (const el of arr) {
        const prev = lastSentVersionsRef.current.get(el.id);
        if (prev !== el.version) toUpsert.push(el);
      }
      const toDelete: string[] = [];
      for (const id of lastSentVersionsRef.current.keys()) {
        if (!nowVersions.has(id)) toDelete.push(id);
      }

      if (toUpsert.length === 0 && toDelete.length === 0) return;

      doc.transact(() => {
        for (const el of toUpsert) elementsMap.set(el.id, el);
        for (const id of toDelete) elementsMap.delete(id);
      }, "local");
      lastSentVersionsRef.current = nowVersions;
    },
    [doc, elementsMap],
  );

  // --------------------------------------------------------------------------
  // Cursor awareness: broadcast our pointer in SCENE coords so peers can place
  // the cursor correctly regardless of their own pan/zoom.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!provider || !apiRef.current) return;
    const api = apiRef.current;
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let lastSent = 0;

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - lastSent < 50) return; // 20 updates/sec max
      lastSent = now;

      const state = api.getAppState?.();
      if (!state) return;
      const zoom = state.zoom?.value ?? 1;
      const scrollX = state.scrollX ?? 0;
      const scrollY = state.scrollY ?? 0;
      // Screen → scene
      const sceneX = lastX / zoom - scrollX;
      const sceneY = lastY / zoom - scrollY;

      const local = provider.awareness.getLocalState() ?? {};
      provider.awareness.setLocalState({
        ...local,
        cursor: { x: sceneX, y: sceneY, space: "scene" },
      });
    };

    document.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [provider]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (!ready || !doc || !elementsMap || renderedElements === null) {
    return (
      <div className="flex h-[calc(100dvh-10rem)] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-sm text-zinc-400">Syncing canvas…</span>
      </div>
    );
  }

  // Excalidraw wants a fresh Map() for appState.collaborators every render.
  const excalidrawInitial = {
    elements: renderedElements,
    appState: { collaborators: new Map() },
    files: {},
  };

  return (
    <div
      className="relative h-[calc(100dvh-10rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
      style={{ minHeight: 520 }}
    >
      <div className="absolute inset-0">
        <Excalidraw
          initialData={excalidrawInitial as never}
          onChange={handleChange}
          excalidrawAPI={(api) => { apiRef.current = api; }}
        />
        {/* Live cursors in scene-space — transformed back to screen on render. */}
        {provider && (
          <CanvasCursors
            provider={provider}
            selfUserId={self.userId}
            getTransform={() => {
              const state = apiRef.current?.getAppState?.();
              return {
                zoom: state?.zoom?.value ?? 1,
                offsetX: state?.scrollX ?? 0,
                offsetY: state?.scrollY ?? 0,
              };
            }}
          />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function readElements(ymap: Y.Map<ExElement>): ExElement[] {
  const arr: ExElement[] = [];
  ymap.forEach((el) => arr.push(el));
  // Excalidraw expects stable ordering — use the `version` timestamp if present,
  // falling back to id so peers converge on the same visual stacking order.
  arr.sort((a, b) => {
    const va = (a.versionNonce as number | undefined) ?? 0;
    const vb = (b.versionNonce as number | undefined) ?? 0;
    if (va !== vb) return va - vb;
    return String(a.id).localeCompare(String(b.id));
  });
  return arr;
}
