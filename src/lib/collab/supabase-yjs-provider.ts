"use client";

import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * A minimal Yjs provider that uses Supabase Realtime broadcast as transport
 * and a caller-supplied snapshot load/save for persistence.
 *
 * Wire format (all payloads JSON on the `broadcast` event channel):
 *   - { kind: "sync-request",  from }                         // "catch me up"
 *   - { kind: "sync-response", from, state: base64Uint8Array } // full state
 *   - { kind: "update",        from, update: base64 }          // Yjs diff
 *   - { kind: "awareness",     from, update: base64 }          // awareness diff
 *
 * Peers ignore messages where `from === this.clientId` (echo suppression).
 * On join, the provider:
 *   1. applies the persisted snapshot (if any) from the DB,
 *   2. broadcasts a `sync-request` so already-connected peers send deltas,
 *   3. subscribes to all broadcasts.
 *
 * Snapshot persistence is debounced — callers provide `saveSnapshot`
 * (typically a server action that UPDATEs `yjs_state` on the row).
 */

function toB64(u8: Uint8Array): string {
  // Browser-safe base64 encode of raw bytes (not a string).
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return typeof btoa !== "undefined" ? btoa(s) : Buffer.from(u8).toString("base64");
}

function fromB64(b64: string): Uint8Array {
  const s = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export interface SupabaseYjsProviderOptions {
  /** Channel name — typically `"doc-" + entityType + "-" + entityId`. */
  channelName: string;
  /** The Yjs document to sync. */
  doc: Y.Doc;
  /** Caller's stable user id — used as the awareness client identifier. */
  userId: string;
  /** Initial awareness state for this client (name, color, etc.). */
  awarenessState?: Record<string, unknown>;
  /** Load the persisted Y state (undefined or null = empty doc). */
  loadSnapshot: () => Promise<Uint8Array | null>;
  /** Persist the current Y state. Called debounced on change. */
  saveSnapshot: (state: Uint8Array) => Promise<void>;
  /** How often to write the snapshot to storage, in ms. Default 3000. */
  saveDebounceMs?: number;
}

export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private channel: RealtimeChannel | null = null;
  private readonly opts: SupabaseYjsProviderOptions;
  private readonly clientId: string;
  private connected = false;
  private destroyed = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedBytes: Uint8Array | null = null;

  /** Resolves once the initial snapshot has been loaded (so the UI can render). */
  readonly ready: Promise<void>;

  constructor(opts: SupabaseYjsProviderOptions) {
    this.opts = opts;
    this.doc = opts.doc;
    this.awareness = new Awareness(this.doc);
    // Random per-tab client id — distinct across tabs for the same user so
    // each tab shows as its own cursor / selection.
    this.clientId =
      opts.userId + ":" + Math.random().toString(36).slice(2, 10);
    this.awareness.setLocalState({
      clientId: this.clientId,
      userId: opts.userId,
      ...(opts.awarenessState ?? {}),
    });

    this.ready = this.init();
  }

  private async init() {
    // 1. Load persisted snapshot first — peers apply deltas on top.
    try {
      const snapshot = await this.opts.loadSnapshot();
      if (snapshot && snapshot.length > 0) {
        Y.applyUpdate(this.doc, snapshot, this);
        this.lastSavedBytes = snapshot;
      }
    } catch {
      // Non-fatal — start with empty doc.
    }
    if (this.destroyed) return;

    // 2. Subscribe to Realtime broadcast.
    const supabase = createClient();
    this.channel = supabase.channel(this.opts.channelName, {
      config: { broadcast: { self: false, ack: false } },
    });

    this.channel.on("broadcast", { event: "msg" }, ({ payload }) => {
      this.onMessage(payload as Record<string, unknown>);
    });

    await new Promise<void>((resolve) => {
      this.channel!.subscribe((status) => {
        if (status === "SUBSCRIBED" && !this.connected) {
          this.connected = true;
          // 3. Ask already-connected peers for any updates we missed.
          this.send({ kind: "sync-request", from: this.clientId });
          // Also broadcast our awareness immediately so peers see us.
          this.broadcastAwareness([this.doc.clientID]);
          resolve();
        } else if (status !== "SUBSCRIBED") {
          resolve();
        }
      });
    });

    // 4. Wire up listeners so LOCAL changes go out.
    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    // 5. Cleanup: remove our awareness state when the tab is closed.
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.onBeforeUnload);
    }
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Ignore updates that came FROM us (we applied a peer's update with
    // `this` as origin inside onMessage — don't broadcast it back).
    if (origin === this) return;
    this.send({ kind: "update", from: this.clientId, update: toB64(update) });
    this.scheduleSave();
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === this) return;
    this.broadcastAwareness([...added, ...updated, ...removed]);
  };

  private broadcastAwareness(clientIds: number[]) {
    if (clientIds.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, clientIds);
    this.send({ kind: "awareness", from: this.clientId, update: toB64(update) });
  }

  private onMessage(payload: Record<string, unknown>) {
    const from = payload.from as string | undefined;
    if (!from || from === this.clientId) return; // Skip own echoes.

    switch (payload.kind) {
      case "sync-request": {
        // A peer just joined — send them our full state so they can catch up.
        const state = Y.encodeStateAsUpdate(this.doc);
        this.send({
          kind: "sync-response",
          from: this.clientId,
          state: toB64(state),
        });
        // Also tell them our awareness.
        this.broadcastAwareness([this.doc.clientID]);
        return;
      }
      case "sync-response": {
        const state = payload.state as string | undefined;
        if (!state) return;
        Y.applyUpdate(this.doc, fromB64(state), this);
        return;
      }
      case "update": {
        const update = payload.update as string | undefined;
        if (!update) return;
        Y.applyUpdate(this.doc, fromB64(update), this);
        return;
      }
      case "awareness": {
        const update = payload.update as string | undefined;
        if (!update) return;
        applyAwarenessUpdate(this.awareness, fromB64(update), this);
        return;
      }
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.channel || !this.connected) return;
    this.channel.send({ type: "broadcast", event: "msg", payload });
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const ms = this.opts.saveDebounceMs ?? 3000;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, ms);
  }

  /** Force-persist the current Yjs state to storage. */
  async flush() {
    if (this.destroyed) return;
    try {
      const bytes = Y.encodeStateAsUpdate(this.doc);
      // Skip if nothing's changed since last save.
      if (this.lastSavedBytes && bytesEqual(bytes, this.lastSavedBytes)) return;
      await this.opts.saveSnapshot(bytes);
      this.lastSavedBytes = bytes;
    } catch {
      // Non-fatal — next tick will retry on next local change.
    }
  }

  private onBeforeUnload = () => {
    removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "window-unload",
    );
  };

  /** Tear down — flush final state, remove listeners, leave the channel. */
  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
    await this.flush();
    if (this.channel) {
      try {
        removeAwarenessStates(
          this.awareness,
          [this.doc.clientID],
          "provider-destroy",
        );
        const supabase = createClient();
        await supabase.removeChannel(this.channel);
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Deterministic color per userId for cursor / selection tinting. */
const AWARE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e",
  "#06b6d4", "#8b5cf6", "#d946ef", "#14b8a6",
];
export function awarenessColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AWARE_COLORS[Math.abs(hash) % AWARE_COLORS.length];
}
