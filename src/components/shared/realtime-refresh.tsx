"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Invisible helper: subscribes to a single-row postgres_changes stream and
 * calls router.refresh() when it fires so the server component above re-runs.
 *
 * Drop into any server-rendered detail page that should reflect peer edits live.
 */
interface Props {
  table: string;
  id: string;
  /** Optional extra filter for scoping, e.g. `workspace_id=eq.${wsId}`. */
  filter?: string;
}

export function RealtimeRefresh({ table, id, filter }: Props) {
  const router = useRouter();
  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`refresh-${table}-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: filter ?? `id=eq.${id}` },
        () => { router.refresh(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, id, filter, router]);
  return null;
}
