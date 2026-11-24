"use client";

import { Copy, Download, Mail, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ConnectSendMode,
  type ParticipantFilters,
  type ParticipantListItem,
  uniqueEmails,
} from "@/lib/big-events/participant-list";
import {
  checkMemberships,
  exportParticipantsCsv,
} from "../../../../_actions/big-event-participants";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalInput,
  PortalSelect,
} from "../../../../_components/portal-fields";
import { STUDIO } from "../../../../_components/studio";
import {
  type ConnectSendReach,
  SendConnectDialog,
} from "./send-connect-dialog";

/** Hands the CSV to the browser; the BOM lets Excel read æ, ø and å. */
function saveCsvFile(csv: string, fileName: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface ParticipantToolbarProps {
  /** Buttons that open things the table owns (add, import). */
  actions: ReactNode;
  bigEventId: string;
  campusFilterOptions: { label: string; value: string }[];
  /** False while the big event is a draft or archived. */
  canSendConnect: boolean;
  /** People connected to an account, whose membership can be checked. */
  connectedCount: number;
  /** Who each toolbar send reaches (ruling R37). */
  connectReach: Record<ConnectSendMode, ConnectSendReach>;
  filters: ParticipantFilters;
  hasRooms: boolean;
  /** A send is running; the button waits so a double click can't queue twice. */
  isSending: boolean;
  onFilterChange: <K extends keyof ParticipantFilters>(
    key: K,
    value: ParticipantFilters[K]
  ) => void;
  /** Called once the organizer has confirmed the send. */
  onSendConnect: (mode: ConnectSendMode) => void;
  /** Only when the caller can see more than one campus. */
  showCampusFilter: boolean;
  /** The rows the filters leave, for "Copy emails" and the download. */
  visibleRows: ParticipantListItem[];
  withoutRoom: number;
}

/** Search and filters on the left; add, check, copy and download on the right. */
export function ParticipantToolbar({
  actions,
  bigEventId,
  campusFilterOptions,
  canSendConnect,
  connectedCount,
  connectReach,
  filters,
  hasRooms,
  isSending,
  onFilterChange,
  onSendConnect,
  showCampusFilter,
  visibleRows,
  withoutRoom,
}: ParticipantToolbarProps) {
  const t = useTranslations("adminPortal.bigEvents.participants");
  const tConnect = useTranslations("adminPortal.bigEvents.connect");
  const tReach = useTranslations("adminPortal.bigEvents.participants.reach");
  const router = useRouter();
  const [isChecking, startCheck] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [confirmMode, setConfirmMode] = useState<ConnectSendMode | null>(null);
  // The second send only means something once someone has had an email.
  const someoneEmailed = connectReach.all.people > connectReach.new.people;

  function runMembershipCheck() {
    if (connectedCount === 0) {
      toast.info(t("memberships.noneConnected"));
      return;
    }
    startCheck(async () => {
      try {
        const result = await checkMemberships(bigEventId);
        const message = t("memberships.done", result);
        if (result.checked < connectedCount) {
          toast.warning(`${message} ${t("memberships.partial")}`);
        } else {
          toast.success(message);
        }
        router.refresh();
      } catch {
        toast.error(t("memberships.failed"));
      }
    });
  }

  async function copyEmails() {
    const emails = uniqueEmails(visibleRows);
    if (emails.length === 0) {
      toast.info(t("nothingToCopy"));
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join("; "));
      toast.success(t("copied", { count: emails.length }));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function downloadCsv() {
    const { pile } = filters;
    startExport(async () => {
      try {
        // The people shown: the same filters, applied again on the server.
        const csv = await exportParticipantsCsv(bigEventId, filters, {
          campus: t("csv.campus"),
          email: t("csv.email"),
          firstName: t("csv.firstName"),
          lastName: t("csv.lastName"),
          phone: t("csv.phone"),
          room: t("csv.room"),
        });
        const suffix = pile === "all" ? "" : ` - ${tReach(pile)}`;
        saveCsvFile(csv, `${t("csvFileName")}${suffix}.csv`);
      } catch {
        toast.error(t("csvFailed"));
      }
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            size={14}
            style={{ color: STUDIO.ink4 }}
          />
          <PortalInput
            aria-label={t("search")}
            className="pl-9"
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder={t("search")}
            type="search"
            value={filters.search}
          />
        </div>
        {showCampusFilter && (
          <PortalSelect
            aria-label={t("campusFilter")}
            className="w-auto"
            onChange={(e) => onFilterChange("campus", e.target.value)}
            options={campusFilterOptions}
            value={filters.campus}
          />
        )}
        {hasRooms && (
          <button
            aria-pressed={filters.noRoom}
            className="rounded-lg border px-3 py-2.5 text-sm transition-colors"
            onClick={() => onFilterChange("noRoom", !filters.noRoom)}
            style={{
              background: filters.noRoom
                ? STUDIO.ink
                : "rgba(255,255,255,0.55)",
              borderColor: filters.noRoom ? STUDIO.ink : STUDIO.rule2,
              color: filters.noRoom ? STUDIO.paper : STUDIO.ink2,
            }}
            type="button"
          >
            {t("notInRoom", { count: withoutRoom })}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <PortalButton
          disabled={!canSendConnect || connectReach.new.people === 0}
          loading={isSending}
          onClick={() => setConfirmMode("new")}
          title={canSendConnect ? undefined : tConnect("publishFirst")}
        >
          {isSending ? null : <Mail aria-hidden size={16} />}
          {tConnect("sendNew", { count: connectReach.new.people })}
        </PortalButton>
        {someoneEmailed && (
          <PortalButton
            disabled={!canSendConnect || isSending}
            onClick={() => setConfirmMode("all")}
            title={canSendConnect ? undefined : tConnect("publishFirst")}
            variant="ghost"
          >
            {tConnect("sendEveryone", { count: connectReach.all.people })}
          </PortalButton>
        )}
        {canSendConnect ? null : (
          <p className="w-full text-xs" style={{ color: STUDIO.ink4 }}>
            {tConnect("publishFirst")}
          </p>
        )}
        <PortalButton
          loading={isChecking}
          onClick={runMembershipCheck}
          title={t("checkMembershipsHelp")}
        >
          {isChecking ? null : <ShieldCheck aria-hidden size={16} />}
          {t("checkMemberships")}
        </PortalButton>
        <PortalButton onClick={copyEmails} title={t("copyEmailsHelp")}>
          <Copy aria-hidden size={16} />
          {t("copyEmails")}
        </PortalButton>
        <PortalButton
          loading={isExporting}
          onClick={downloadCsv}
          title={t("downloadCsvHelp")}
        >
          {isExporting ? null : <Download aria-hidden size={16} />}
          {t("downloadCsv")}
        </PortalButton>
      </div>
      <SendConnectDialog
        mode={confirmMode}
        onConfirm={(mode) => {
          setConfirmMode(null);
          onSendConnect(mode);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmMode(null);
          }
        }}
        reach={connectReach}
      />
    </div>
  );
}
