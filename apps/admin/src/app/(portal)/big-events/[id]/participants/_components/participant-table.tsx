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
import { Plus, TriangleAlert, Upload, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  emptyParticipantForm,
  type ParticipantCampusId,
  participantFormInitial,
} from "@/lib/big-events/participant-form";
import {
  ALL_CAMPUSES,
  canSendConnectEmail,
  filterParticipants,
  NO_CAMPUS,
  type ParticipantFilters,
  type ParticipantList,
  type ParticipantListItem,
  participantName,
} from "@/lib/big-events/participant-list";
import {
  removeParticipants,
  sendConnectEmails,
} from "../../../../_actions/big-event-participants";
import { EmptyState } from "../../../../_components/empty-state";
import { PortalButton } from "../../../../_components/portal-button";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  StudioLinkButton,
  StudioPanel,
} from "../../../../_components/studio";
import { LinkAccountDialog, UnlinkAccountDialog } from "./link-account-dialog";
import { type CampusOption, ParticipantDialog } from "./participant-dialog";
import { ParticipantRow } from "./participant-row";
import { ParticipantToolbar } from "./participant-toolbar";
import { ReachSummary } from "./reach-summary";

interface ParticipantTableProps {
  bigEventId: string;
  /** Campuses the caller may give someone; `""` stands for "No campus". */
  campusOptions: CampusOption[];
  /** Pre-selected campus when adding someone. */
  defaultCampusId: ParticipantCampusId | null;
  /** Connect emails go out only for a published big event. */
  isPublished: boolean;
  list: ParticipantList;
}

/** Which dialog is open; `key` remounts it so its form starts fresh. */
type DialogState = { key: number; row: ParticipantListItem | null } | null;

const HEAD_CELL =
  "px-4 py-2.5 text-left font-medium text-[11px] uppercase tracking-[0.06em]";

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
  isPublished,
  campusOptions,
  defaultCampusId,
  list,
}: ParticipantTableProps) {
  const t = useTranslations("adminPortal.bigEvents.participants");
  const tImport = useTranslations("adminPortal.bigEvents.import");
  const tConnect = useTranslations("adminPortal.bigEvents.connect");
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
  const [isRemoving, startRemove] = useTransition();
  const [isSending, startSend] = useTransition();
  const [linkTarget, setLinkTarget] = useState<ParticipantListItem | null>(
    null
  );
  const [unlinkTarget, setUnlinkTarget] = useState<ParticipantListItem | null>(
    null
  );

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
  const sendableCount = useMemo(
    () => list.rows.filter(canSendConnectEmail).length,
    [list.rows]
  );
  const connectedCount = list.counts.push + list.counts.app_no_push;

  const setFilter = <K extends keyof ParticipantFilters>(
    key: K,
    value: ParticipantFilters[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openDialog = (row: ParticipantListItem | null) =>
    setDialog((prev) => ({ key: (prev?.key ?? 0) + 1, row }));

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

  /** Queues the connect email for one person, or for everyone when no row is given. */
  function sendConnect(row?: ParticipantListItem) {
    startSend(async () => {
      try {
        const result = await sendConnectEmails(
          bigEventId,
          row ? [row.$id] : undefined
        );
        if (result.queued === 0) {
          toast.info(tConnect("nothingToSend"));
        } else {
          toast.success(tConnect("queued", { count: result.queued }));
        }
        router.refresh();
      } catch {
        toast.error(tConnect("failed"));
      }
    });
  }

  const addButtons = (
    <>
      <StudioLinkButton
        href={`/big-events/${bigEventId}/participants/import`}
        variant="primary"
      >
        <Upload aria-hidden size={16} />
        {tImport("button")}
      </StudioLinkButton>
      <PortalButton onClick={() => openDialog(null)}>
        <Plus aria-hidden size={16} />
        {t("addPerson")}
      </PortalButton>
    </>
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
          <div className="flex flex-wrap justify-center gap-2">
            {addButtons}
          </div>
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

      <ParticipantToolbar
        actions={addButtons}
        bigEventId={bigEventId}
        campusFilterOptions={campusFilterOptions}
        canSendConnect={isPublished}
        connectedCount={connectedCount}
        filters={filters}
        hasRooms={list.hasRooms}
        isSending={isSending}
        onFilterChange={setFilter}
        onSendConnect={() => sendConnect()}
        sendableCount={sendableCount}
        showCampusFilter={campusOptions.length > 1}
        visibleRows={visibleRows}
        withoutRoom={withoutRoom}
      />

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
                  onLink={setLinkTarget}
                  onRemove={setRemoveTarget}
                  onSendAgain={sendConnect}
                  onUnlink={setUnlinkTarget}
                  row={row}
                  sendDisabled={isSending || !isPublished}
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
      {linkTarget && (
        <LinkAccountDialog
          bigEventId={bigEventId}
          key={linkTarget.$id}
          onOpenChange={(open) => {
            if (!open) {
              setLinkTarget(null);
            }
          }}
          row={linkTarget}
        />
      )}
      <UnlinkAccountDialog
        onOpenChange={(open) => {
          if (!open) {
            setUnlinkTarget(null);
          }
        }}
        row={unlinkTarget}
      />
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
