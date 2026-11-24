"use client";

import {
  CalendarX,
  CircleCheck,
  Link2Off,
  Ticket,
  TicketCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  NeedsBiSignInState,
  StateCard,
} from "@/app/(public)/membership/join/gate-states";
import { connectTicket } from "@/app/actions/big-event-connect";
import { AppStoreBadge } from "@/components/layout/app-store-badge";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import type { ConnectView } from "@/lib/big-events/connect";

type ConfirmView = Extract<ConnectView, { state: "confirm" }>;

/**
 * Asks before linking. Linking happens only here, on the button: email
 * scanners open every link in an email, so opening the page must change
 * nothing.
 */
function ConfirmState({ token, view }: { token: string; view: ConfirmView }) {
  const t = useTranslations("bigEvents.connect.confirm");
  const [isConnecting, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const connect = () => {
    setFailed(false);
    start(async () => {
      try {
        // On success the action refreshes this page, which then shows
        // "connected" (or why it couldn't connect).
        const result = await connectTicket(token);
        setFailed(!result.ok);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <StateCard
      alert={
        failed ? (
          <p
            className="type-body-sm rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
            role="alert"
          >
            {t("failed")}
          </p>
        ) : null
      }
      body={t("question", {
        accountEmail: view.accountEmail,
        eventName: view.eventName,
        holderName: view.holderName,
      })}
      icon={Ticket}
      title={view.eventName}
    >
      <button
        aria-busy={isConnecting}
        className={`${statusPanelPrimaryAction} disabled:opacity-60`}
        disabled={isConnecting}
        onClick={connect}
        type="button"
      >
        {isConnecting ? t("connecting") : t("cta")}
      </button>
      <p className="type-body-sm basis-full text-ink-muted">
        {t("notYou", { holderName: view.holderName })}
      </p>
    </StateCard>
  );
}

/**
 * No "Open in the app" link yet (ruling R32): `/app/big-events/<slug>` has no
 * web page until Stage 4, and released apps ignore `/app/` paths they don't
 * know. The store buttons get the student the app that will show the event.
 */
function ConnectedState() {
  const t = useTranslations("bigEvents.connect.connected");
  const tApp = useTranslations("common.footer.app");
  return (
    <StateCard body={t("body")} icon={CircleCheck} title={t("title")}>
      <p className="type-label basis-full text-ink">{tApp("heading")}</p>
      <div className="flex basis-full flex-wrap gap-2.5">
        <AppStoreBadge
          hint={tApp("appleHint")}
          platform="ios"
          storeName={tApp("appleStore")}
        />
        <AppStoreBadge
          hint={tApp("googleHint")}
          platform="android"
          storeName={tApp("googlePlay")}
        />
      </div>
    </StateCard>
  );
}

/** The big event is over: no new link would work either, so none is offered. */
function EndedState() {
  const t = useTranslations("bigEvents.connect.ended");
  return <StateCard icon={CalendarX} title={t("title")} />;
}

function InvalidState() {
  const t = useTranslations("bigEvents.connect.invalid");
  return (
    <StateCard body={t("body")} icon={Link2Off} title={t("title")}>
      <Link className={statusPanelSecondaryAction} href="/connect/help">
        {t("cta")}
      </Link>
    </StateCard>
  );
}

/** One state of `/connect/<token>`, as `resolveConnectToken` read it. */
export function ConnectStates({
  token,
  view,
}: {
  token: string;
  view: ConnectView;
}) {
  const t = useTranslations("bigEvents.connect");
  const returnTo = `/connect/${token}`;

  switch (view.state) {
    case "confirm":
      return <ConfirmState token={token} view={view} />;
    case "connected":
      return <ConnectedState />;
    case "signed_out":
      return (
        <NeedsBiSignInState
          body={t("signedOut.body")}
          failedText={t("signInFailed")}
          returnTo={returnTo}
          title={view.eventName}
        />
      );
    case "needs_bi":
      return (
        <NeedsBiSignInState
          body={t("needsBi.body")}
          failedText={t("signInFailed")}
          returnTo={returnTo}
        />
      );
    case "linked_to_other":
      return (
        <StateCard
          body={t("linkedToOther.body")}
          icon={UserX}
          title={t("linkedToOther.title")}
        />
      );
    case "ended":
      return <EndedState />;
    case "account_has_ticket":
      return (
        <StateCard
          body={t("accountHasTicket.body")}
          icon={TicketCheck}
          title={t("accountHasTicket.title", { eventName: view.eventName })}
        />
      );
    default:
      return <InvalidState />;
  }
}
