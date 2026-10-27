"use client";

import type {
  EventRsvpStatus,
  EventRsvpSummary,
} from "@repo/shared/utils/event-rsvp";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { respondToEvent } from "@/app/actions/event-rsvp";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import { rsvpCountParts } from "./event-fields";
import { settleRsvpSave } from "./rsvp-save";

const ANSWERS: {
  key: "going" | "maybe" | "notGoing";
  status: EventRsvpStatus;
}[] = [
  { key: "going", status: "going" },
  { key: "maybe", status: "maybe" },
  { key: "notGoing", status: "not_going" },
];

const buttonBase =
  "type-label flex-1 rounded-biso-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

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

  return (
    <div className="mt-5">
      <p className="type-label text-ink-muted">{title}</p>

      {canRespond ? (
        <fieldset
          aria-label={title}
          className="m-0 mt-2 flex min-w-0 gap-2 border-0 p-0"
        >
          {ANSWERS.map(({ key, status }) => {
            const selected = summary.mine === status;
            return (
              <button
                aria-pressed={selected}
                className={`${buttonBase} ${
                  selected
                    ? "bg-action text-action-ink"
                    : "border border-edge text-ink"
                }`}
                disabled={pending}
                key={status}
                onClick={() => choose(status)}
                type="button"
              >
                {t(`rsvp.${key}`)}
              </button>
            );
          })}
        </fieldset>
      ) : null}

      {signedIn ? null : (
        <div className="mt-2">
          <Link className={statusPanelSecondaryAction} href={signInHref}>
            {t("rsvp.signIn")}
          </Link>
        </div>
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
