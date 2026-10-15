"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { useState, useTransition } from "react";
import { confirmBookingSlot } from "@/app/actions/booking";

interface BookingClientProps {
  applicantEmail: string;
  availabilityChecked: boolean;
  durationMinutes: number;
  /** ISO start times, computed on the server from the panel's calendars. */
  slots: string[];
  token: string;
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BookingClient({
  applicantEmail,
  availabilityChecked,
  durationMinutes,
  slots,
  token,
}: BookingClientProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    invited: boolean;
    startsAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!selected) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmBookingSlot(token, selected);
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmed({
          invited: result.data.invited,
          startsAt: result.data.starts_at,
        });
      }
    });
  }

  if (confirmed) {
    return (
      <Card className="mt-6 border-border/60 p-6 shadow-sm">
        <h2 className="font-semibold text-foreground text-lg">
          You're booked!
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Interview confirmed for {formatSlot(confirmed.startsAt)} (
          {durationMinutes} minutes).{" "}
          {confirmed.invited
            ? `A calendar invite with the Teams link is on its way to ${applicantEmail}.`
            : "The BISO team will send you the meeting details by email."}
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-muted-foreground text-xs">
        {availabilityChecked
          ? "Times shown are when the interview panel is free."
          : "Times shown are BISO office hours; the team will confirm the slot."}
      </p>
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
