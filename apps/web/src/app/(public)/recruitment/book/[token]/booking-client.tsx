"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { useMemo, useState, useTransition } from "react";
import { confirmBookingSlot } from "@/app/actions/booking";

interface BookingClientProps {
  durationMinutes: number;
  token: string;
  windowFrom: string;
  windowTo: string;
}

function generateSlots(from: string, to: string, duration: number): string[] {
  const start = new Date(from);
  const end = new Date(to);
  const slots: string[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() + duration * 60_000 <= end.getTime();
    cursor = new Date(cursor.getTime() + 60 * 60_000)
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
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BookingClient({
  durationMinutes,
  token,
  windowFrom,
  windowTo,
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
    if (!selected) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmBookingSlot(token, selected, durationMinutes);
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmedAt(result.data.starts_at);
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
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
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
        {slots.length === 0 && (
          <p className="col-span-2 text-muted-foreground text-sm">
            No slots available in this window. Please contact the BISO team.
          </p>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={!selected || isPending}
        onClick={handleConfirm}
        type="button"
      >
        {isPending ? "Confirming…" : "Confirm interview slot"}
      </Button>
    </div>
  );
}
