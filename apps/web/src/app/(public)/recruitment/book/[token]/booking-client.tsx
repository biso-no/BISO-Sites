"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { useMemo, useState, useTransition } from "react";

interface BookingClientProps {
  token: string;
  windowFrom: string;
  windowTo: string;
  durationMinutes: number;
}

function generateSlots(
  windowFrom: string,
  windowTo: string,
  duration: number
): string[] {
  const from = new Date(windowFrom);
  const to = new Date(windowTo);
  const slots: string[] = [];
  const step = 60; // minute step
  for (
    let cursor = new Date(from);
    cursor.getTime() + duration * 60_000 <= to.getTime();
    cursor = new Date(cursor.getTime() + step * 60_000)
  ) {
    const hour = cursor.getHours();
    if (hour < 9 || hour > 17) {
      continue;
    }
    slots.push(cursor.toISOString());
  }
  return slots;
}

function formatSlot(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BookingClient({
  token,
  windowFrom,
  windowTo,
  durationMinutes,
}: BookingClientProps) {
  const slots = useMemo(
    () => generateSlots(windowFrom, windowTo, durationMinutes),
    [windowFrom, windowTo, durationMinutes]
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const apiBase =
        (typeof window !== "undefined"
          ? (window as { __BOOKING_API_BASE__?: string }).__BOOKING_API_BASE__
          : null) ?? "";
      try {
        const response = await fetch(
          `${apiBase}/api/recruitment/booking/${encodeURIComponent(token)}`,
          {
            body: JSON.stringify({
              duration_minutes: durationMinutes,
              starts_at: selected,
              token,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: { starts_at: string };
          error?: string;
        } | null;
        if (!response.ok) {
          setError(payload?.error ?? "Could not confirm this slot.");
          return;
        }
        setConfirmedAt(payload?.data?.starts_at ?? selected);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Network error."
        );
      }
    });
  }

  if (confirmedAt) {
    return (
      <Card className="mt-6 border-border/60 p-6 shadow-sm">
        <h2 className="font-semibold text-foreground text-lg">
          You're booked!
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Interview confirmed for {formatSlot(confirmedAt)}. You'll receive a
          calendar invite shortly.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slots.map((slot) => (
          <button
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              selected === slot
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border bg-background text-foreground hover:border-brand"
            }`}
            key={slot}
            onClick={() => setSelected(slot)}
            type="button"
          >
            {formatSlot(slot)}
          </button>
        ))}
        {slots.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No slots available in this window. Please contact the BISO team.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <Button
        className="w-full"
        disabled={!selected || isPending}
        onClick={handleConfirm}
        type="button"
      >
        {isPending ? "Confirming..." : "Confirm interview slot"}
      </Button>
    </div>
  );
}
