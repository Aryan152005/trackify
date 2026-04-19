"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Thin server actions to load/save the binary Yjs state for a given entity.
 *
 * We store the raw Uint8Array in Postgres as BYTEA (column `yjs_state` on
 * drawings/mindmaps/pages, added in migration 032). Supabase's postgrest
 * round-trips BYTEA as a `\x...` hex string on read and accepts a plain
 * byte array on write — both conversions happen in this file so callers
 * only deal in `Uint8Array` / `base64`.
 *
 * We intentionally don't write BOTH the Yjs state AND the legacy JSON here
 * — that's the caller's job (the Yjs observer computes the derived JSON
 * and passes it to the existing save action). This file ONLY knows about
 * the binary blob so it stays tiny and entity-agnostic.
 */

type CollabEntity = "drawings" | "mindmaps" | "pages";

function assertEntity(entity: string): asserts entity is CollabEntity {
  if (entity !== "drawings" && entity !== "mindmaps" && entity !== "pages") {
    throw new Error(`Unsupported collab entity: ${entity}`);
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/**
 * Returns the stored Yjs state as base64, or null if the row has no state
 * yet (fresh entity, or one from before migration 032). Caller decodes.
 */
export async function loadYjsSnapshot(
  entity: string,
  id: string,
): Promise<string | null> {
  assertEntity(entity);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from(entity)
    .select("yjs_state")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load ${entity}:${id} — ${error.message}`);
  if (!data || !data.yjs_state) return null;

  // Supabase returns BYTEA as \x-prefixed hex or as a base64 string depending
  // on the driver. Normalise to base64 for the client.
  const raw = data.yjs_state as unknown;
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) {
      // hex → base64
      const hex = raw.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return Buffer.from(bytes).toString("base64");
    }
    return raw;
  }
  // Buffer-like
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString("base64");
  return null;
}

/**
 * Save the binary Yjs state for an entity. RLS on the underlying table is
 * responsible for enforcing that the caller is allowed to write the row —
 * we just pipe the bytes.
 */
export async function saveYjsSnapshot(
  entity: string,
  id: string,
  stateB64: string,
): Promise<void> {
  assertEntity(entity);
  const { supabase } = await requireUser();
  const bytes = Buffer.from(stateB64, "base64");
  // Postgrest accepts BYTEA as a hex string with a \x prefix.
  const hex = "\\x" + bytes.toString("hex");
  const { error } = await supabase
    .from(entity)
    .update({ yjs_state: hex })
    .eq("id", id);
  if (error) throw new Error(`Failed to save Yjs state: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Append-only update log (migration 039)
//
// The snapshot is a recovery checkpoint; the log is the source of truth
// between snapshots. Every local Yjs update is appended here the moment
// it happens (batched ~300ms client-side via Y.mergeUpdates) so no edit
// is lost if the tab closes before the debounced snapshot fires.
// ---------------------------------------------------------------------------

export interface YjsLogEntry {
  id: number;
  update_b64: string;
}

/**
 * Append one (possibly-merged) Yjs update to the log for an entity.
 * Returns the new row id so the caller can track compaction cursors.
 */
export async function appendYjsUpdate(
  entity: string,
  id: string,
  updateB64: string,
  clientId: string,
): Promise<number> {
  assertEntity(entity);
  const { supabase } = await requireUser();
  const bytes = Buffer.from(updateB64, "base64");
  const hex = "\\x" + bytes.toString("hex");
  const { data, error } = await supabase
    .from("yjs_updates")
    .insert({
      entity,
      entity_id: id,
      update_bytes: hex,
      client_id: clientId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to append update: ${error.message}`);
  return (data?.id as number) ?? 0;
}

/**
 * Load every log entry for an entity (ordered by id ASC so apply order
 * matches insert order). Used on initial mount + to reconcile after a
 * dropped broadcast. Ordering is stable because `id` is a BIGSERIAL.
 */
export async function loadYjsUpdates(
  entity: string,
  id: string,
): Promise<YjsLogEntry[]> {
  assertEntity(entity);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("yjs_updates")
    .select("id, update_bytes")
    .eq("entity", entity)
    .eq("entity_id", id)
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load updates: ${error.message}`);

  return (data ?? []).map((r) => {
    const raw = r.update_bytes as unknown;
    let b64 = "";
    if (typeof raw === "string") {
      if (raw.startsWith("\\x")) {
        const hex = raw.slice(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        b64 = Buffer.from(bytes).toString("base64");
      } else {
        b64 = raw;
      }
    } else if (raw instanceof Uint8Array) {
      b64 = Buffer.from(raw).toString("base64");
    }
    return { id: r.id as number, update_b64: b64 };
  });
}

/**
 * Snapshot + compact: write the current merged state into `yjs_state`
 * on the entity row, then delete log entries with id <= `upToId`. The
 * snapshot MUST be written before the delete — if delete fails we keep
 * harmlessly duplicated (idempotent) log entries, but if snapshot fails
 * we never lose data.
 *
 * `upToId` should be the max log-row id the caller has already merged
 * into their in-memory doc — never an id newer than that.
 */
export async function compactYjsUpdates(
  entity: string,
  id: string,
  snapshotB64: string,
  upToId: number,
): Promise<void> {
  assertEntity(entity);
  const { supabase } = await requireUser();

  // 1. Write the snapshot.
  const bytes = Buffer.from(snapshotB64, "base64");
  const hex = "\\x" + bytes.toString("hex");
  const { error: snapErr } = await supabase
    .from(entity)
    .update({ yjs_state: hex })
    .eq("id", id);
  if (snapErr) throw new Error(`Compact snapshot failed: ${snapErr.message}`);

  // 2. Delete the log entries we just folded in. Safe to fail — they'll
  // get replayed on next load (idempotent under CRDT merge) and deleted
  // next compaction.
  if (upToId > 0) {
    await supabase
      .from("yjs_updates")
      .delete()
      .eq("entity", entity)
      .eq("entity_id", id)
      .lte("id", upToId);
  }
}
