"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type TableEvent = "INSERT" | "UPDATE" | "DELETE";

interface UseRealtimeOptions {
  table: string;
  schema?: string;
  filter?: string;
  event?: TableEvent | "*";
  onInsert?: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => void;
  onUpdate?: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => void;
  onDelete?: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => void;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions) {
  const {
    table,
    schema = "public",
    filter,
    event = "*",
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  // Keep callback refs stable to avoid re-subscribing on every render
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  callbacksRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `realtime-${table}-${filter || "all"}-${Date.now()}`;

    const channelConfig: {
      event: "INSERT" | "UPDATE" | "DELETE" | "*";
      schema: string;
      table: string;
      filter?: string;
    } = { event, schema, table };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        channelConfig,
        (
          payload: RealtimePostgresChangesPayload<Record<string, unknown>>
        ) => {
          const { onInsert, onUpdate, onDelete } = callbacksRef.current;

          switch (payload.eventType) {
            case "INSERT":
              onInsert?.(payload);
              break;
            case "UPDATE":
              onUpdate?.(payload);
              break;
            case "DELETE":
              onDelete?.(payload);
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, filter, event, enabled]);
}
