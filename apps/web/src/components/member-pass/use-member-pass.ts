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

const TICK_MS = 1000;

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

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const response = await fetch("/api/member-pass", { cache: "no-store" });
      if (!response.ok) {
        setData({ state: "unavailable" });
        return;
      }
      const body = (await response.json()) as MemberPassResponse;
      if (body.state === "active") {
        drift.current = body.serverNow - Date.now();
      }
      setData(body);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
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
