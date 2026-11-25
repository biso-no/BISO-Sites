"use client";

import { GROUP_KINDS, type GroupKind } from "@repo/shared/big-events/tables";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  emptyGroupForm,
  groupFormInitial,
} from "@/lib/big-events/buses/group-form";
import {
  deleteGroup,
  type GroupsView,
  type GroupView,
} from "../../../../_actions/big-event-groups";
import { PortalButton } from "../../../../_components/portal-button";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import { defaultGroupCampus, GroupDialog } from "./group-dialog";
import { GroupList } from "./group-list";
import { MoveConfirmProvider } from "./move-confirm";

/** What the tab can open from anywhere inside it, e.g. from the bus board. */
export interface GroupActions {
  add: (kind: GroupKind) => void;
  edit: (group: GroupView) => void;
  remove: (group: GroupView) => void;
}

const GroupActionsContext = createContext<GroupActions | null>(null);

/** The tab's data, for a component in a slot: it isn't sent to the browser twice. */
interface GroupsTabData {
  bigEventId: string;
  view: GroupsView;
}

const GroupsTabDataContext = createContext<GroupsTabData | null>(null);

/** The tab's group dialog and delete confirm, for a component in a slot. */
export function useGroupActions(): GroupActions {
  const actions = useContext(GroupActionsContext);
  if (!actions) {
    throw new Error("useGroupActions is only available inside GroupsTab");
  }
  return actions;
}

/** The big event and the groups view the tab shows, e.g. for the bus board. */
export function useGroupsTabData(): GroupsTabData {
  const data = useContext(GroupsTabDataContext);
  if (!data) {
    throw new Error("useGroupsTabData is only available inside GroupsTab");
  }
  return data;
}

interface GroupsTabProps {
  /** Full access may make groups with no campus (N8). */
  allowsNoCampus: boolean;
  bigEventId: string;
  /**
   * The Buses section's body (ruling R1): the bus board goes here. Without
   * it, the section shows a plain list of the buses and their people.
   */
  busBoard?: ReactNode;
  /** The big event's own campus: where a new group starts. */
  eventCampusId: string;
  view: GroupsView;
}

/** Which dialog is open; `key` remounts it so its form starts fresh. */
type DialogState = {
  group: GroupView | null;
  key: number;
  kind: GroupKind;
} | null;

/** Seats taken on a bus, also by people the caller can't see and rooms' open places. */
function seatsTaken(group: GroupView): number {
  return group.seats ? group.seats.out + group.seats.home : 0;
}

/** People riding a bus either way, also those the caller can't see. */
function ridersOn(group: GroupView): number {
  return group.riders ? group.riders.out + group.riders.home : 0;
}

/** People are in it, or (a bus) seats are held for a room. */
function isInUse(group: GroupView): boolean {
  return group.members.length > 0 || seatsTaken(group) > 0;
}

interface DeleteGroupDialogProps {
  /** After publishing, a bus with people on it can't be deleted (N6). */
  blocked: boolean;
  group: GroupView | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
}

function DeleteGroupDialog({
  blocked,
  group,
  onConfirm,
  onOpenChange,
  pending,
}: DeleteGroupDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.groups.deleteDialog");
  const tc = useTranslations("adminPortal.common");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={group !== null}>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("title", { name: group?.name ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {blocked ? t("busPublished") : t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <PortalButton
            disabled={blocked}
            loading={pending}
            onClick={onConfirm}
            variant="danger"
          >
            {t("confirm")}
          </PortalButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The Groups tab: Buses (while Travel is on), Rooms, Buddy groups, Teams and
 * Other, each with an "Add" button, its groups and the people in them.
 */
export function GroupsTab({
  allowsNoCampus,
  bigEventId,
  busBoard,
  eventCampusId,
  view,
}: GroupsTabProps) {
  const t = useTranslations("adminPortal.bigEvents.groups");
  const tb = useTranslations("adminPortal.bigEvents");
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupView | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const sections = GROUP_KINDS.filter((kind) => kind !== "bus" || view.travel);
  const byKind = useMemo(() => {
    const map = new Map<GroupKind, GroupView[]>();
    for (const group of view.groups) {
      map.set(group.kind, [...(map.get(group.kind) ?? []), group]);
    }
    return map;
  }, [view.groups]);
  const campusChoices = {
    allowsNoCampus,
    campusIds: view.manageableCampuses,
  };
  const campusLabel = (campusId: string | null) =>
    campusId ? tb(`campuses.${campusId}`) : t("noCampus");

  const actions = useMemo<GroupActions>(
    () => ({
      add: (kind) =>
        setDialog((prev) => ({ group: null, key: (prev?.key ?? 0) + 1, kind })),
      edit: (group) =>
        setDialog((prev) => ({
          group,
          key: (prev?.key ?? 0) + 1,
          kind: group.kind,
        })),
      remove: setDeleteTarget,
    }),
    []
  );

  // People riding, not the people shown: someone the caller can't see
  // counts too, a room's open places don't (the server checks the same).
  const deleteBlocked =
    deleteTarget?.kind === "bus" &&
    view.publishedAt !== null &&
    ridersOn(deleteTarget) > 0;
  const tabData = useMemo(() => ({ bigEventId, view }), [bigEventId, view]);

  function confirmDelete() {
    const group = deleteTarget;
    if (!group) {
      return;
    }
    startDelete(async () => {
      try {
        await deleteGroup(group.$id);
        toast.success(t("deleteDialog.deleted", { name: group.name }));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(tb("form.saveFailed"));
      }
    });
  }

  return (
    <GroupsTabDataContext.Provider value={tabData}>
      <GroupActionsContext.Provider value={actions}>
        <MoveConfirmProvider
          published={view.travel && view.publishedAt !== null}
        >
          <div className="flex flex-col gap-10">
            {sections.map((kind) => (
              <section aria-labelledby={`groups-${kind}`} key={kind}>
                <div
                  className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-3"
                  style={{ borderColor: STUDIO.rule }}
                >
                  <h2
                    className="text-3xl leading-none"
                    id={`groups-${kind}`}
                    style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                  >
                    {t(`sections.${kind}`)}
                  </h2>
                  <PortalButton onClick={() => actions.add(kind)} size="sm">
                    <Plus aria-hidden size={14} />
                    {t(`add.${kind}`)}
                  </PortalButton>
                </div>
                {kind === "bus" && busBoard ? (
                  busBoard
                ) : (
                  <GroupList
                    bigEventId={bigEventId}
                    campusLabel={campusLabel}
                    groups={byKind.get(kind) ?? []}
                    kind={kind}
                    onDelete={actions.remove}
                    onEdit={actions.edit}
                  />
                )}
              </section>
            ))}
          </div>

          {dialog && (
            <GroupDialog
              bigEventId={bigEventId}
              campusChoices={campusChoices}
              group={dialog.group ?? undefined}
              initial={
                dialog.group
                  ? groupFormInitial(dialog.group)
                  : emptyGroupForm(
                      dialog.kind,
                      defaultGroupCampus(
                        dialog.kind,
                        view.manageableCampuses,
                        eventCampusId
                      )
                    )
              }
              key={dialog.key}
              locked={dialog.group ? isInUse(dialog.group) : false}
              onOpenChange={(open) => {
                if (!open) {
                  setDialog(null);
                }
              }}
              open
              travel={view.travel}
            />
          )}
          <DeleteGroupDialog
            blocked={deleteBlocked}
            group={deleteTarget}
            onConfirm={confirmDelete}
            onOpenChange={(open) => {
              if (!(open || isDeleting)) {
                setDeleteTarget(null);
              }
            }}
            pending={isDeleting}
          />
        </MoveConfirmProvider>
      </GroupActionsContext.Provider>
    </GroupsTabDataContext.Provider>
  );
}
