"use client";

import type {
  EventRsvpStatus,
  EventRsvpSummary,
} from "@repo/shared/utils/event-rsvp";
import { Check, CircleHelp, LogIn, type LucideIcon, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { respondToEvent } from "@/app/actions/event-rsvp";
import { rsvpCountParts } from "./event-fields";
import { settleRsvpSave } from "./rsvp-save";

const ANSWERS: {
  Icon: LucideIcon;
  key: "going" | "maybe" | "notGoing";
  status: EventRsvpStatus;
}[] = [
  { Icon: Check, key: "going", status: "going" },
  { Icon: CircleHelp, key: "maybe", status: "maybe" },
  { Icon: X, key: "notGoing", status: "not_going" },
];

/*
 * Outlined in the action colour, not `border-edge`: the edge hairline is
 * 1.2:1 on the card, so the first version's buttons read as plain text.
 * `border-action` is 5.8:1, past the 3:1 a control's outline needs.
 */
const buttonBase =
  "type-label inline-flex min-h-11 items-center justify-center gap-1.5 rounded-biso-sm border border-action px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";
const buttonIdle = "text-ink-accent hover:bg-surface-sunken";
const buttonSelected = "bg-action text-action-ink";

/**
 * Going / Maybe / Not going on the event's action card.
 *
 * A client island: the answer and the counts change at once, then settle on
 * what the server returns, or revert if the save failed.
 */
export function EventRsvp({
  canRespond,
  eventId,
  hasTicket,
  initial,
  signedIn,
  signInHref,
}: {
  canRespond: boolean;
  eventId: string;
  hasTicket: boolean;
  initial: EventRsvpSummary;
  signInHref: string;
  signedIn: boolean;
}) {
  const t = useTranslations("events");
  const [summary, setSummary] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (clicked: EventRsvpStatus) => {
    const previous = summary;
    const next = previous.mine === clicked ? null : clicked;
    const counts = { ...previous.counts };
    if (previous.mine === "going" || previous.mine === "maybe") {
      counts[previous.mine] -= 1;
    }
    if (next === "going" || next === "maybe") {
      counts[next] += 1;
    }
    setFailed(false);
    setSummary({ ...previous, counts, mine: next });
    startTransition(async () => {
      const settled = await settleRsvpSave(
        respondToEvent,
        eventId,
        next,
        previous
      );
      setSummary(settled.summary);
      setFailed(settled.failed);
    });
  };

  const title = t("rsvp.title");
  const parts = rsvpCountParts(summary.counts);

  const showTitle = !signedIn || canRespond;
  if (!(showTitle || parts.length > 0 || hasTicket)) {
    return null;
  }

  return (
    <div className="mt-5">
      {showTitle ? <p className="type-label text-ink-muted">{title}</p> : null}

      {canRespond ? (
        // "Going" spans the row and the other two share the next one, so
        // "Kommer ikke" (98px) fits on one line in the 22rem sidebar instead
        // of wrapping in a third of it.
        <fieldset
          aria-label={title}
          className="m-0 mt-2 grid min-w-0 grid-cols-2 gap-2 border-0 p-0"
        >
          {ANSWERS.map(({ Icon, key, status }) => {
            const selected = summary.mine === status;
            return (
              <button
                aria-pressed={selected}
                className={`${buttonBase} ${selected ? buttonSelected : buttonIdle} ${
                  status === "going" ? "col-span-2" : ""
                }`}
                disabled={pending}
                key={status}
                onClick={() => choose(status)}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{t(`rsvp.${key}`)}</span>
              </button>
            );
          })}
        </fieldset>
      ) : null}

      {signedIn ? null : (
        <Link
          className={`${buttonBase} ${buttonIdle} mt-2 w-full`}
          href={signInHref}
        >
          <LogIn aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{t("rsvp.signIn")}</span>
        </Link>
      )}

      {parts.length > 0 ? (
        <p className="type-body-sm mt-3 text-ink-muted">
          {parts
            .map(({ count, key }) => t(`rsvp.${key}`, { count }))
            .join(" · ")}
        </p>
      ) : null}

      {hasTicket ? (
        <p className="type-body-sm mt-2 text-ink-muted">
          {t("rsvp.ticketHint")}
        </p>
      ) : null}

      {failed ? (
        <p className="type-body-sm mt-2 text-ink" role="status">
          {t("rsvp.saveFailed")}
        </p>
      ) : null}
    </div>
  );
}
