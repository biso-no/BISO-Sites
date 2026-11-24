"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatOsloShortDay } from "@/lib/big-events/dates";
import {
  emptyParticipantForm,
  type ParticipantCampusId,
  participantFormInitial,
} from "@/lib/big-events/participant-form";
import {
  ALL_CAMPUSES,
  filterParticipants,
  NO_CAMPUS,
  type ParticipantFilters,
  type ParticipantList,
  type ParticipantListItem,
  type PileFilter,
  participantName,
  uniqueEmails,
} from "@/lib/big-events/participant-list";
import {
  checkMemberships,
  exportParticipantsCsv,
  removeParticipants,
} from "../../../../_actions/big-event-participants";
import { EmptyState } from "../../../../_components/empty-state";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalInput,
  PortalSelect,
} from "../../../../_components/portal-fields";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  StudioPanel,
} from "../../../../_components/studio";
import { type CampusOption, ParticipantDialog } from "./participant-dialog";
import { PILE_ICONS, ReachSummary } from "./reach-summary";

interface ParticipantTableProps {
  bigEventId: string;
  /** Campuses the caller may give someone; `""` stands for "No campus". */
  campusOptions: CampusOption[];
  /** Pre-selected campus when adding someone. */
  defaultCampusId: ParticipantCampusId | null;
  list: ParticipantList;
}

/** Which dialog is open; `key` remounts it so its form starts fresh. */
type DialogState = { key: number; row: ParticipantListItem | null } | null;

const CELL = "px-4 py-3 align-top";
const HEAD_CELL =
  "px-4 py-2.5 text-left font-medium text-[11px] uppercase tracking-[0.06em]";

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

interface RowProps {
  campusLabel: (campusId: string | null) => string;
  onEdit: (row: ParticipantListItem) => void;
  onRemove: (row: ParticipantListItem) => void;
  row: ParticipantListItem;
  showRoom: boolean;
}

function ParticipantRow({
  campusLabel,
  onEdit,
  onRemove,
  row,
  showRoom,
}: RowProps) {
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

interface RemoveDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  row: ParticipantListItem | null;
}

function RemoveDialog({
  onConfirm,
  onOpenChange,
  pending,
  row,
}: RemoveDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.participants.removeDialog");
  const tc = useTranslations("adminPortal.common");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={row !== null}>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("title", { name: row ? participantName(row) : "" })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <PortalButton loading={pending} onClick={onConfirm} variant="danger">
            {t("confirm")}
          </PortalButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The participants tab: reach chips, filters, toolbar and the list itself. */
export function ParticipantTable({
  bigEventId,
  campusOptions,
  defaultCampusId,
  list,
}: ParticipantTableProps) {
  const t = useTranslations("adminPortal.bigEvents.participants");
  const tReach = useTranslations("adminPortal.bigEvents.participants.reach");
  const router = useRouter();
  const [filters, setFilters] = useState<ParticipantFilters>({
    campus: ALL_CAMPUSES,
    noRoom: false,
    pile: "all",
    search: "",
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removeTarget, setRemoveTarget] = useState<ParticipantListItem | null>(
    null
  );
  const [isChecking, startCheck] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  const visibleRows = useMemo(
    () => filterParticipants(list.rows, filters),
    [list.rows, filters]
  );
  const withoutRoom = useMemo(
    () => list.rows.filter((row) => row.roomName === null).length,
    [list.rows]
  );
  const campusNames = useMemo(
    () => new Map(campusOptions.map((option) => [option.value, option.label])),
    [campusOptions]
  );
  const campusLabel = (campusId: string | null) =>
    campusId ? (campusNames.get(campusId) ?? campusId) : t("noCampusOption");
  const campusFilterOptions = [
    { label: t("allCampuses"), value: ALL_CAMPUSES },
    ...campusOptions.map((option) =>
      option.value === ""
        ? { label: t("noCampusOption"), value: NO_CAMPUS }
        : option
    ),
  ];
  const connectedCount = list.counts.push + list.counts.app_no_push;

  const setFilter = <K extends keyof ParticipantFilters>(
    key: K,
    value: ParticipantFilters[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openDialog = (row: ParticipantListItem | null) =>
    setDialog((prev) => ({ key: (prev?.key ?? 0) + 1, row }));

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
    const pile: PileFilter = filters.pile;
    startExport(async () => {
      try {
        const csv = await exportParticipantsCsv(bigEventId, pile, {
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

  function confirmRemove() {
    const row = removeTarget;
    if (!row) {
      return;
    }
    startRemove(async () => {
      try {
        await removeParticipants([row.$id]);
        toast.success(
          t("removeDialog.removed", { name: participantName(row) })
        );
        setRemoveTarget(null);
        router.refresh();
      } catch {
        toast.error(t("removeDialog.failed"));
      }
    });
  }

  const addButton = (
    <PortalButton onClick={() => openDialog(null)} variant="primary">
      <Plus aria-hidden size={16} />
      {t("addPerson")}
    </PortalButton>
  );

  const participantDialog = dialog && (
    <ParticipantDialog
      bigEventId={bigEventId}
      campusOptions={campusOptions}
      initial={
        dialog.row
          ? participantFormInitial(dialog.row)
          : emptyParticipantForm(defaultCampusId)
      }
      key={dialog.key}
      onOpenChange={(open) => {
        if (!open) {
          setDialog(null);
        }
      }}
      open
      participantId={dialog.row?.$id}
    />
  );

  if (list.rows.length === 0) {
    return (
      <>
        <EmptyState
          description={t("empty.description")}
          icon={<Users aria-hidden size={28} />}
          title={t("empty.title")}
        >
          {addButton}
        </EmptyState>
        {participantDialog}
      </>
    );
  }

  return (
    <div>
      <ReachSummary
        active={filters.pile}
        counts={list.counts}
        onSelect={(pile) => setFilter("pile", pile)}
        total={list.rows.length}
      />

      {list.noCampus > 0 && (
        <p
          className="mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "rgba(176,138,62,0.09)",
            borderColor: "rgba(176,138,62,0.24)",
            color: "#6a5118",
          }}
        >
          <TriangleAlert aria-hidden className="mt-0.5 shrink-0" size={16} />
          {t("noCampus", { count: list.noCampus })}
        </p>
      )}

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
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder={t("search")}
              type="search"
              value={filters.search}
            />
          </div>
          {campusOptions.length > 1 && (
            <PortalSelect
              aria-label={t("campusFilter")}
              className="w-auto"
              onChange={(e) => setFilter("campus", e.target.value)}
              options={campusFilterOptions}
              value={filters.campus}
            />
          )}
          {list.hasRooms && (
            <button
              aria-pressed={filters.noRoom}
              className="rounded-lg border px-3 py-2.5 text-sm transition-colors"
              onClick={() => setFilter("noRoom", !filters.noRoom)}
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
          {addButton}
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
      </div>

      <StudioPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}>
              <tr>
                <th className={HEAD_CELL} scope="col">
                  {t("columns.name")}
                </th>
                <th className={HEAD_CELL} scope="col">
                  {t("columns.campus")}
                </th>
                {list.hasRooms && (
                  <th className={HEAD_CELL} scope="col">
                    {t("columns.room")}
                  </th>
                )}
                <th className={HEAD_CELL} scope="col">
                  {t("columns.status")}
                </th>
                <th className={HEAD_CELL} scope="col">
                  {t("columns.membership")}
                </th>
                <th className={HEAD_CELL} scope="col">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <ParticipantRow
                  campusLabel={campusLabel}
                  key={row.$id}
                  onEdit={openDialog}
                  onRemove={setRemoveTarget}
                  row={row}
                  showRoom={list.hasRooms}
                />
              ))}
            </tbody>
          </table>
        </div>
        {visibleRows.length === 0 && (
          <p
            className="border-t px-4 py-10 text-center text-sm"
            style={{ borderColor: STUDIO.rule, color: STUDIO.ink3 }}
          >
            {t("noMatches")}
          </p>
        )}
      </StudioPanel>
      {visibleRows.length !== list.rows.length && (
        <p
          className="mt-3 text-xs"
          style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
        >
          {t("showing", {
            shown: visibleRows.length,
            total: list.rows.length,
          })}
        </p>
      )}

      {participantDialog}
      <RemoveDialog
        onConfirm={confirmRemove}
        onOpenChange={(open) => {
          if (!(open || isRemoving)) {
            setRemoveTarget(null);
          }
        }}
        pending={isRemoving}
        row={removeTarget}
      />
    </div>
  );
}
