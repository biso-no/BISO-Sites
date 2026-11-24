"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatOsloShortDay } from "@/lib/big-events/dates";
import {
  type ParticipantListItem,
  participantName,
} from "@/lib/big-events/participant-list";
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

interface ParticipantRowProps {
  campusLabel: (campusId: string | null) => string;
  onEdit: (row: ParticipantListItem) => void;
  onRemove: (row: ParticipantListItem) => void;
  row: ParticipantListItem;
  showRoom: boolean;
}

/** One person in the participants table. */
export function ParticipantRow({
  campusLabel,
  onEdit,
  onRemove,
  row,
  showRoom,
}: ParticipantRowProps) {
  const t = useTranslations("adminPortal.bigEvents.participants");
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
