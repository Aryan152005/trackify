"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { loadYjsSnapshot, saveYjsSnapshot } from "@/lib/collab/snapshot-actions";
import {
  SupabaseYjsProvider,
  awarenessColor,
} from "@/lib/collab/supabase-yjs-provider";

interface UseYjsDocOptions {
  entity: "drawings" | "mindmaps" | "pages";
  id: string;
  /** When false, the provider is not mounted (useful while data is loading). */
  enabled?: boolean;
}

interface UseYjsDocResult {
  doc: Y.Doc | null;
  provider: SupabaseYjsProvider | null;
  /** True once the initial snapshot has been loaded from the DB. */
  ready: boolean;
  /** Stable local user identity (also set in awareness). */
  self: {
    userId: string | null;
    name: string;
    color: string;
  };
}

/**
 * Mounts a Y.Doc + Supabase provider for a single entity and tears it
 * down on unmount. Returns the doc once the initial snapshot is loaded
 * so consumers can render against stable state.
 *
 * The caller is responsible for shaping the doc (e.g. `doc.getArray("elements")`
 * for Excalidraw, `doc.getMap("nodes")` for mindmaps, or `doc.getXmlFragment("doc")`
 * for BlockNote). This hook only handles the transport.
 */
export function useYjsDoc({ entity, id, enabled = true }: UseYjsDocOptions): UseYjsDocResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [provider, setProvider] = useState<SupabaseYjsProvider | null>(null);

  // Stable per-mount Y.Doc. Re-create if entity/id changes.
  const doc = useMemo(() => (enabled && id ? new Y.Doc() : null), [enabled, id]);

  // Track the provider so we can destroy it on unmount even if rapid
  // prop changes create a new one before we clean up.
  const providerRef = useRef<SupabaseYjsProvider | null>(null);

  // Resolve current user (for awareness state). One-shot.
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("user_id", uid)
          .maybeSingle();
        setUserName((profile?.name as string) ?? (data.user?.email ?? "Guest"));
      }
    })();
  }, [enabled]);

  // Mount the provider once we have everything we need.
  useEffect(() => {
    if (!enabled || !doc || !id || !userId) return;

    let cancelled = false;
    const p = new SupabaseYjsProvider({
      channelName: `doc-${entity}-${id}`,
      doc,
      userId,
      awarenessState: {
        name: userName,
        color: awarenessColor(userId),
      },
      loadSnapshot: async () => {
        const b64 = await loadYjsSnapshot(entity, id);
        if (!b64) return null;
        const s = atob(b64);
        const u8 = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
        return u8;
      },
      saveSnapshot: async (bytes) => {
        let s = "";
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        const b64 = btoa(s);
        await saveYjsSnapshot(entity, id, b64);
      },
    });
    providerRef.current = p;
    setProvider(p);

    p.ready.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      providerRef.current = null;
      setProvider(null);
      setReady(false);
      p.destroy();
      doc.destroy();
    };
  }, [enabled, doc, entity, id, userId, userName]);

  return {
    doc,
    provider,
    ready,
    self: {
      userId,
      name: userName,
      color: userId ? awarenessColor(userId) : "#6366f1",
    },
  };
}
