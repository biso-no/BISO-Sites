"use client";

import type { RealtimeResponseEvent } from "appwrite";
import { Channel, Realtime } from "appwrite";
import { useEffect, useRef } from "react";
import { clientSideClient } from "./client";

export type { RealtimeResponseEvent } from "appwrite";
// Re-exports so app code never imports `appwrite` directly.
export { Channel } from "appwrite";

/**
 * Structural subset of the SDK `Realtime` class used by the subscription
 * manager. Lets unit tests inject a fake without a WebSocket.
 */
export interface RealtimeLike {
  subscribe(
    channels: string[],
    callback: (event: RealtimeResponseEvent<Record<string, unknown>>) => void
  ): Promise<{
    unsubscribe: () => Promise<void>;
    update: (changes: { channels?: string[] }) => Promise<void>;
  }>;
}

export interface RealtimeSubscriptionHandle {
  dispose: () => void;
}

let currentSessionSecret: string | null = null;

/**
 * Authenticate the shared browser client for realtime. Idempotent — safe to
 * call on every provider mount. Required whenever the Appwrite session is not
 * available under the standard `a_session_<project>` cookie name (admin's
 * custom httpOnly cookie, and all localhost dev).
 */
export function setRealtimeSession(secret: string): void {
  if (!secret || secret === currentSessionSecret) {
    return;
  }
  currentSessionSecret = secret;
  clientSideClient.setSession(secret);
}

let realtimeInstance: Realtime | null = null;

/** Lazy singleton — one WebSocket per tab, shared by all subscriptions. */
export function getRealtime(): Realtime {
  if (!realtimeInstance) {
    realtimeInstance = new Realtime(clientSideClient);
  }
  return realtimeInstance;
}

/** Channel string for all row events of one table, e.g. shop orders. */
export function tableRowsChannel(databaseId: string, tableId: string): string {
  return Channel.tablesdb(databaseId).table(tableId).row().toString();
}

/**
 * Subscription lifecycle manager. Handles the async subscribe/dispose race:
 * disposing before the subscribe promise settles must still tear down the
 * server-side subscription and stop event delivery.
 */
export function manageRealtimeSubscription(
  realtime: RealtimeLike,
  channels: string[],
  onEvent: (event: RealtimeResponseEvent<Record<string, unknown>>) => void,
  onError?: (error: unknown) => void
): RealtimeSubscriptionHandle {
  let disposed = false;
  let active: Awaited<ReturnType<RealtimeLike["subscribe"]>> | null = null;

  realtime
    .subscribe(channels, (event) => {
      if (!disposed) {
        onEvent(event);
      }
    })
    .then((subscription) => {
      if (disposed) {
        subscription.unsubscribe().catch(() => {
          /* connection already gone — nothing to clean up */
        });
        return;
      }
      active = subscription;
    })
    .catch((error) => {
      if (!disposed) {
        onError?.(error);
      }
    });

  return {
    dispose: () => {
      disposed = true;
      active?.unsubscribe().catch(() => {
        /* connection already gone — nothing to clean up */
      });
      active = null;
    },
  };
}

/**
 * Subscribe to realtime channels for the lifetime of the component.
 * `onEvent` identity changes never resubscribe (kept in a ref); channel
 * array contents are compared by value.
 */
export function useRealtimeChannels(options: {
  channels: string[];
  enabled?: boolean;
  onEvent: (event: RealtimeResponseEvent<Record<string, unknown>>) => void;
}): void {
  const { channels, enabled = true, onEvent } = options;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const channelsKey = channels.join("|");

  useEffect(() => {
    if (!enabled || channelsKey.length === 0) {
      return;
    }
    const handle = manageRealtimeSubscription(
      getRealtime(),
      channelsKey.split("|"),
      (event) => onEventRef.current(event),
      (error) => {
        // Degrade silently to request/response behavior (spec §4).
        console.warn("[realtime] subscription failed", error);
      }
    );
    return () => handle.dispose();
  }, [channelsKey, enabled]);
}
