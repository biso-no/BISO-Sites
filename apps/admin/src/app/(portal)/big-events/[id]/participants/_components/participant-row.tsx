"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { formatOsloShortDay } from "@/lib/big-events/dates";
import {
  canSendConnectEmail,
  type ParticipantListItem,
  type ParticipantSuggestion,
  participantName,
} from "@/lib/big-events/participant-list";
import {
  acceptSuggestion,
  dismissSuggestion,
} from "../../../../_actions/big-event-linking";
import { PortalButton } from "../../../../_components/portal-button";
import { STUDIO } from "../../../../_components/studio";
import { PILE_ICONS } from "./reach-summary";

const CELL = "px-4 py-3 align-top";

/** "Connected", "Connect email sent 3 Dec" or "Not connected". */
function StatusText({ row }: { row: ParticipantListItem }) {
  const t = useTranslations("adminPortal.bigEvents.participants.status");
  const locale = useLocale();
  if (row.user_id) {
    return <p>{t("connected")}</p>;
  }
  if (row.connect_sent_at) {
    return (
      <p>
        {t("connectSent", {
          date: formatOsloShortDay(row.connect_sent_at, locale),
        })}
      </p>
    );
  }
  return <p>{t("notConnected")}</p>;
}

/** "Possible match: Kari Nordmann (kari@bi.no) · same phone" with Link and Not them. */
function PossibleMatch({
  row,
  suggestion,
}: {
  row: ParticipantListItem;
  suggestion: ParticipantSuggestion;
}) {
  const t = useTranslations("adminPortal.bigEvents.link");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const who = suggestion.email
    ? t("possibleMatch", { email: suggestion.email, name: suggestion.name })
    : t("possibleMatchNoEmail", { name: suggestion.name });

  function accept() {
    startTransition(async () => {
      try {
        const result = await acceptSuggestion(row.$id);
        if (!result.ok) {
          toast.error(t(`refused.${result.reason}`));
          return;
        }
        toast.success(
          t("linked", {
            email: suggestion.email ?? suggestion.name,
            name: participantName(row),
          })
        );
        router.refresh();
      } catch {
        toast.error(t("failed"));
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      try {
        await dismissSuggestion(row.$id);
        toast.success(t("dismissed"));
        router.refresh();
      } catch {
        toast.error(t("failed"));
      }
    });
  }

  return (
    <div
      className="mt-2 rounded-lg border px-3 py-2 text-xs"
      style={{
        background: "rgba(42,74,122,0.06)",
        borderColor: "rgba(42,74,122,0.2)",
        color: STUDIO.sky,
      }}
    >
      <p className="break-words">
        {who} · {t(`reasons.${suggestion.reason}`)}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <PortalButton disabled={isPending} onClick={accept} size="sm">
          {t("accept")}
        </PortalButton>
        <PortalButton
          disabled={isPending}
          onClick={dismiss}
          size="sm"
          variant="ghost"
        >
          {t("dismiss")}
        </PortalButton>
      </div>
    </div>
  );
}

interface ParticipantRowProps {
  campusLabel: (campusId: string | null) => string;
  onEdit: (row: ParticipantListItem) => void;
  onLink: (row: ParticipantListItem) => void;
  onRemove: (row: ParticipantListItem) => void;
  onSendAgain: (row: ParticipantListItem) => void;
  onUnlink: (row: ParticipantListItem) => void;
  row: ParticipantListItem;
  /** True while a send is running or the big event isn't published. */
  sendDisabled: boolean;
  showRoom: boolean;
}

/** One person in the participants table. */
export function ParticipantRow({
  campusLabel,
  onEdit,
  onLink,
  onRemove,
  onSendAgain,
  onUnlink,
  row,
  sendDisabled,
  showRoom,
}: ParticipantRowProps) {
  const t = useTranslations("adminPortal.bigEvents.participants");
  const tLink = useTranslations("adminPortal.bigEvents.link");
  const tConnect = useTranslations("adminPortal.bigEvents.connect");
  const tReach = useTranslations("adminPortal.bigEvents.participants.reach");
  const name = participantName(row);
  const PileIcon = PILE_ICONS[row.pile];
  const muted = { color: STUDIO.ink4 };

  return (
    <tr className="border-t text-sm" style={{ borderColor: STUDIO.rule }}>
      <td className={CELL}>
        <p className="font-medium" style={{ color: STUDIO.ink }}>
          {name}
        </p>
        {row.ticket_email && (
          <p className="mt-0.5 break-all text-xs" style={muted}>
            {row.ticket_email}
          </p>
        )}
      </td>
      <td
        className={CELL}
        style={{ color: row.campus_id ? STUDIO.ink2 : STUDIO.ink4 }}
      >
        {campusLabel(row.campus_id)}
      </td>
      {showRoom && (
        <td
          className={CELL}
          style={{ color: row.roomName ? STUDIO.ink2 : STUDIO.ink4 }}
        >
          {row.roomName ? t("roomName", { name: row.roomName }) : t("noRoom")}
        </td>
      )}
      <td className={CELL}>
        <div className="flex items-start gap-2" style={{ color: STUDIO.ink2 }}>
          <span className="mt-0.5 shrink-0" title={tReach(row.pile)}>
            <PileIcon aria-hidden size={14} />
            <span className="sr-only">{tReach(row.pile)}</span>
          </span>
          <div className="min-w-0">
            <StatusText row={row} />
            {row.accountEmail && (
              <p className="mt-0.5 break-all text-xs" style={muted}>
                {row.accountEmail}
              </p>
            )}
            {!row.user_id && row.suggestion && (
              <PossibleMatch row={row} suggestion={row.suggestion} />
            )}
          </div>
        </div>
      </td>
      <td className={CELL}>
        {row.membership_valid === false && (
          <span
            className="inline-flex rounded-full border px-2.5 py-0.5 font-medium text-[11px]"
            style={{
              background: "rgba(107,30,30,0.07)",
              borderColor: "rgba(107,30,30,0.22)",
              color: STUDIO.claret,
            }}
          >
            {t("noValidMembership")}
          </span>
        )}
      </td>
      <td className={`${CELL} text-right`}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t("rowMenu", { name })}
              className="rounded-md p-1.5 transition-colors hover:bg-black/5"
              style={{ color: STUDIO.ink3 }}
              type="button"
            >
              <MoreHorizontal aria-hidden size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(row)}>
              {t("edit")}
            </DropdownMenuItem>
            {row.user_id ? (
              <DropdownMenuItem onSelect={() => onUnlink(row)}>
                {tLink("unlink")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onLink(row)}>
                {tLink("linkAccount")}
              </DropdownMenuItem>
            )}
            {canSendConnectEmail(row) && (
              <DropdownMenuItem
                disabled={sendDisabled}
                onSelect={() => onSendAgain(row)}
              >
                {tConnect("sendAgain")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => onRemove(row)}
              style={{ color: STUDIO.claret }}
            >
              {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
