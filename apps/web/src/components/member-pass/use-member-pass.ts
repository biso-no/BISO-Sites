"use client";

import {
  codesRemaining,
  MEMBER_PASS_REFETCH_BELOW,
  type MemberPassCode,
  passSlot,
  selectCurrentCode,
  slotSecondsLeft,
} from "@repo/shared/utils/member-pass-slots";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberPassResponse } from "@/lib/member-pass/types";
import { nextPassState, type PassFetchOutcome } from "./pass-refresh";

const TICK_MS = 1000;
const HTTP_UNAUTHORIZED = 401;

async function fetchPass(): Promise<PassFetchOutcome> {
  try {
    const response = await fetch("/api/member-pass", { cache: "no-store" });
    if (response.status === HTTP_UNAUTHORIZED) {
      return { kind: "unauthenticated" };
    }
    if (!response.ok) {
      return { kind: "server_error" };
    }
    return {
      body: (await response.json()) as MemberPassResponse,
      kind: "body",
    };
  } catch {
    return { kind: "network_error" };
  }
}

/**
 * Loads the member pass and keeps the visible code in step with the clock.
 * Codes live only in component state — never in storage.
 */
export function useMemberPass() {
  const [data, setData] = useState<MemberPassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const drift = useRef(0);
  const inFlight = useRef(false);
  // Mirrors `data`; only `load` sets it, so it never lags a render.
  const shown = useRef<MemberPassResponse | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    const outcome = await fetchPass();
    if (outcome.kind === "body" && outcome.body.state === "active") {
      drift.current = outcome.body.serverNow - Date.now();
    }
    const slot = passSlot(Date.now() + drift.current);
    const next = nextPassState(shown.current, outcome, slot);
    shown.current = next.data;
    setData(next.data);
    setOffline(next.offline);
    inFlight.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
    };
  }, [load]);

  const correctedNow = now + drift.current;
  const slot = passSlot(correctedNow);
  const codes: MemberPassCode[] = data?.state === "active" ? data.codes : [];
  const remaining = codesRemaining(codes, slot);

  useEffect(() => {
    if (data?.state === "active" && remaining < MEMBER_PASS_REFETCH_BELOW) {
      load();
    }
  }, [data, remaining, load]);

  return {
    current: selectCurrentCode(codes, slot),
    data,
    loading,
    now: correctedNow,
    offline,
    refresh: load,
    secondsLeft: slotSecondsLeft(correctedNow),
  };
}
