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
  /** Persist the current Y state. Called during periodic compaction. */
  saveSnapshot: (state: Uint8Array) => Promise<void>;
  /** How often to write the snapshot to storage, in ms. Default 3000. */
  saveDebounceMs?: number;

  // ── Append-only update log (migration 039). When these three are
  //   present, the provider switches on "persist every update" mode —
  //   single-keystroke durability, tab-close safety, cross-peer recovery.
  /** Append one merged Yjs update to the durable log. Returns the new row id. */
  appendUpdate?: (updateB64: string, clientId: string) => Promise<number>;
  /** Load every log entry for this entity (ordered). Applied after snapshot. */
  loadUpdates?: () => Promise<{ id: number; update_b64: string }[]>;
  /** Save full snapshot + delete log rows with id <= upToId. */
  compact?: (snapshotB64: string, upToId: number) => Promise<void>;
  /** Tab-close beacon target — typically `/api/collab/append-update`. */
  beaconUrl?: string;
  /** Entity identity for the beacon payload (url-path-safe). */
  beaconEntity?: string;
  beaconEntityId?: string;
  /** Per-update batch window, default 300 ms. */
  appendDebounceMs?: number;
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

  // ── Update-log state.
  /** Pending local updates since last appendFlush. Merged before send. */
  private pendingUpdates: Uint8Array[] = [];
  /** Debounce timer for appendFlush. */
  private appendTimer: ReturnType<typeof setTimeout> | null = null;
  /** Max log row id we've applied (ours or fetched). Used as compact cursor. */
  private maxAppliedLogId = 0;
  /** Compaction timer — runs periodically to snapshot + truncate. */
  private compactTimer: ReturnType<typeof setInterval> | null = null;

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

    // 1b. Replay any unmerged log entries on top of the snapshot. These
    // are updates other peers (or this user from a prior tab) persisted
    // but that weren't yet folded into the snapshot. Without this step,
    // recovering from "tab closed mid-edit" is impossible.
    if (this.opts.loadUpdates) {
      try {
        const entries = await this.opts.loadUpdates();
        for (const entry of entries) {
          const bytes = fromB64(entry.update_b64);
          Y.applyUpdate(this.doc, bytes, this);
          if (entry.id > this.maxAppliedLogId) {
            this.maxAppliedLogId = entry.id;
          }
        }
      } catch {
        // Non-fatal — fall back to snapshot-only.
      }
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

    // 5. Cleanup: remove our awareness state when the tab is closed, and
    // use the last unload moment to flush any pending update via a
    // keepalive fetch so the final stroke doesn't die with the tab.
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.onBeforeUnload);
      window.addEventListener("pagehide", this.onBeforeUnload);
    }

    // 6. Kick off periodic compaction — every 60s, write a fresh snapshot
    // and delete folded-in log rows. Keeps the log table bounded.
    if (this.opts.compact) {
      this.compactTimer = setInterval(() => {
        void this.compact();
      }, 60_000);
    }
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Ignore updates that came FROM us (we applied a peer's update with
    // `this` as origin inside onMessage — don't broadcast it back).
    if (origin === this) return;

    // 1. Realtime: broadcast to peers for instant-collab.
    this.send({ kind: "update", from: this.clientId, update: toB64(update) });

    // 2. Durable: queue for the update log. If the caller didn't wire the
    // log up, fall back to the old snapshot-debounce behavior.
    if (this.opts.appendUpdate) {
      this.pendingUpdates.push(update);
      this.scheduleAppend();
    } else {
      this.scheduleSave();
    }
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

  /** Force-persist the current Yjs state to storage (legacy snapshot mode). */
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

  // ── Append-log plumbing.
  private scheduleAppend() {
    if (this.appendTimer) return; // already queued
    const ms = this.opts.appendDebounceMs ?? 300;
    this.appendTimer = setTimeout(() => {
      this.appendTimer = null;
      void this.flushAppend();
    }, ms);
  }

  /**
   * Merge all pending local updates into a single Yjs update and persist
   * it to the log. Uses Y.mergeUpdates so a burst of small edits lands
   * as one row, keeping the log dense rather than one row per keystroke.
   */
  private async flushAppend() {
    if (this.destroyed) return;
    if (!this.opts.appendUpdate) return;
    if (this.pendingUpdates.length === 0) return;
    const batch = this.pendingUpdates;
    this.pendingUpdates = [];
    try {
      const merged =
        batch.length === 1 ? batch[0] : Y.mergeUpdates(batch);
      const rowId = await this.opts.appendUpdate(toB64(merged), this.clientId);
      if (rowId > this.maxAppliedLogId) this.maxAppliedLogId = rowId;
    } catch {
      // On failure, put them back so the next tick / compact retries.
      this.pendingUpdates.unshift(...batch);
    }
  }

  /** Snapshot the current state and delete now-redundant log rows. */
  private async compact() {
    if (this.destroyed) return;
    if (!this.opts.compact) return;
    // Fold any pending in-memory updates into the log first so they
    // become eligible for deletion in this pass.
    await this.flushAppend();
    try {
      const bytes = Y.encodeStateAsUpdate(this.doc);
      await this.opts.compact(toB64(bytes), this.maxAppliedLogId);
      this.lastSavedBytes = bytes;
    } catch {
      // Non-fatal — next tick retries.
    }
  }

  private onBeforeUnload = () => {
    // Best-effort last-chance persist. `fetch({ keepalive: true })` keeps
    // the request alive after the tab closes (max ~64 KB payload —
    // Yjs updates are usually far smaller). If the log path isn't wired,
    // skip — legacy snapshot mode loses last ~3s of edits regardless.
    if (
      this.opts.beaconUrl &&
      this.opts.beaconEntity &&
      this.opts.beaconEntityId &&
      this.pendingUpdates.length > 0 &&
      typeof fetch !== "undefined"
    ) {
      try {
        const merged =
          this.pendingUpdates.length === 1
            ? this.pendingUpdates[0]
            : Y.mergeUpdates(this.pendingUpdates);
        const payload = JSON.stringify({
          entity: this.opts.beaconEntity,
          entityId: this.opts.beaconEntityId,
          updateB64: toB64(merged),
          clientId: this.clientId,
        });
        fetch(this.opts.beaconUrl, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: payload,
        }).catch(() => {
          /* page is unloading — we tried */
        });
        this.pendingUpdates = [];
      } catch {
        /* swallow */
      }
    }

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
    if (this.appendTimer) clearTimeout(this.appendTimer);
    if (this.compactTimer) clearInterval(this.compactTimer);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.onBeforeUnload);
      window.removeEventListener("pagehide", this.onBeforeUnload);
    }

    // Before ripping down the channel, guarantee the log is up-to-date
    // and then compact one last time. Order matters: append any pending
    // updates FIRST (so other peers replaying later pick them up), then
    // save a snapshot that folds them in + delete the now-merged rows.
    if (this.opts.appendUpdate) {
      // Reset destroyed briefly so flushAppend + compact actually run.
      this.destroyed = false;
      try {
        await this.flushAppend();
        await this.compact();
      } finally {
        this.destroyed = true;
      }
    } else {
      await this.flush();
    }

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
