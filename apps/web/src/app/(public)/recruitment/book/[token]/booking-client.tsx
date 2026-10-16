"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmBookingSlot } from "@/app/actions/booking";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

interface BookingClientProps {
  applicantEmail: string;
  availabilityChecked: boolean;
  durationMinutes: number;
  /** ISO start times, computed on the server from the panel's calendars. */
  slots: string[];
  token: string;
}

/**
 * The slots are office hours in Oslo (`getBookingContext`), so they are shown
 * in Oslo time and the page says so. Formatting in the server's or the
 * browser's own zone instead would render one set of times on the server and
 * another after hydration.
 */
const TIME_ZONE = "Europe/Oslo";

const intlLocale = (locale: string) => (locale === "no" ? "nb-NO" : "en-GB");

interface SlotDay {
  key: string;
  label: string;
  slots: { iso: string; time: string }[];
}

/** Slots arrive in order; each day becomes one group of times. */
function groupByDay(slots: string[], locale: string): SlotDay[] {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  });
  const dayLabel = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
    weekday: "long",
  });
  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

  const days = new Map<string, SlotDay>();
  for (const iso of slots) {
    const date = new Date(iso);
    const key = dayKey.format(date);
    let day = days.get(key);
    if (!day) {
      const label = dayLabel.format(date);
      day = {
        key,
        label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1),
        slots: [],
      };
      days.set(key, day);
    }
    day.slots.push({ iso, time: time.format(date) });
  }
  return [...days.values()];
}

function formatSlot(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * Replaces the picker once the slot is booked. The button the candidate
 * pressed is gone, so focus moves to this heading.
 */
function BookedPanel({
  applicantEmail,
  durationMinutes,
  invited,
  startsAt,
}: {
  applicantEmail: string;
  durationMinutes: number;
  invited: boolean;
  startsAt: string;
}) {
  const t = useTranslations("jobs.booking");
  const locale = useLocale();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="rounded-biso-md border border-edge p-6">
      <h2
        className="type-heading-card text-ink focus:outline-none"
        ref={heading}
        tabIndex={-1}
      >
        {t("booked")}
      </h2>
      <p className="type-body mt-2 text-ink-muted">
        {t("confirmed", {
          minutes: durationMinutes,
          time: formatSlot(startsAt, locale),
        })}{" "}
        {/* Whether Outlook accepted the invite, not a promise that it will. */}
        {invited ? t("invited", { email: applicantEmail }) : t("notInvited")}
      </p>
    </div>
  );
}

export function BookingClient({
  applicantEmail,
  availabilityChecked,
  durationMinutes,
  slots,
  token,
}: BookingClientProps) {
  const t = useTranslations("jobs.booking");
  const locale = useLocale();
  const days = useMemo(() => groupByDay(slots, locale), [slots, locale]);
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
      <BookedPanel
        applicantEmail={applicantEmail}
        durationMinutes={durationMinutes}
        invited={confirmed.invited}
        startsAt={confirmed.startsAt}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Without Microsoft Graph the slots are plain office hours, and the
          candidate is told the team will confirm rather than that the panel
          is free. */}
      <p className="type-body-sm text-ink-muted">
        {availabilityChecked ? t("panelFree") : t("officeHours")}{" "}
        {t("timeZoneNote")}
      </p>

      {days.length > 0 ? (
        <fieldset className="space-y-6">
          <legend className="sr-only">{t("slotsLabel")}</legend>
          {days.map((day) => (
            <fieldset key={day.key}>
              <legend className="type-heading-card text-ink">
                {day.label}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {day.slots.map((slot) => {
                  const isSelected = selected === slot.iso;
                  return (
                    <label
                      className={cn(
                        "type-data inline-flex min-w-20 cursor-pointer items-center justify-center gap-1.5 rounded-biso-pill border px-4 py-2 transition-colors",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface",
                        isSelected
                          ? "border-transparent bg-action text-action-ink"
                          : "border-edge text-ink hover:border-ink-accent"
                      )}
                      key={slot.iso}
                    >
                      <input
                        checked={isSelected}
                        className="sr-only"
                        name="interview-slot"
                        onChange={() => setSelected(slot.iso)}
                        type="radio"
                        value={slot.iso}
                      />
                      {/* Selection is shown by more than colour. */}
                      {isSelected ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : null}
                      {slot.time}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </fieldset>
      ) : (
        <p className="type-body text-ink-muted">{t("noSlots")}</p>
      )}

      {error ? (
        <p className="type-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {days.length > 0 ? (
        <button
          className={cn(
            statusPanelPrimaryAction,
            "w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          )}
          disabled={!selected || isPending}
          onClick={handleConfirm}
          type="button"
        >
          {isPending ? t("confirming") : t("confirm")}
        </button>
      ) : null}
    </div>
  );
}
