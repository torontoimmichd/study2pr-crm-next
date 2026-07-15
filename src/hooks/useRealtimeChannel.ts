"use client";

// src/hooks/useRealtimeChannel.ts
//
// Subscribes to one or more Supabase Realtime postgres_changes filters.
// Cleans up on unmount.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface ChannelConfig {
  table: string;
  schema?: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtimeChannel(channelName: string, configs: ChannelConfig[]) {
  useEffect(() => {
    if (configs.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel = supabase.channel(channelName) as any;
    for (const c of configs) {
      channel = channel.on(
        "postgres_changes",
        {
          event: c.event || "*",
          schema: c.schema || "public",
          table: c.table,
          ...(c.filter ? { filter: c.filter } : {}),
        },
        c.onChange
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(configs.map(c => ({ t: c.table, f: c.filter, e: c.event })))]);
}
