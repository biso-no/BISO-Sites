"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import { moveToGroup } from "../../../../_actions/big-event-buses";
import type {
  GroupMemberView,
  GroupView,
} from "../../../../_actions/big-event-groups";
import { STUDIO } from "../../../../_components/studio";
import { roomMoveChangesBus } from "./bus-board-model";
import { useGroupsTabData } from "./groups-view";
import { useMoveConfirm } from "./move-confirm";

/** A group for people of every campus: no campus, or National. */
function isCampusWide(group: Pick<GroupView, "campus_id">): boolean {
  return group.campus_id === null || group.campus_id === NATIONAL_CAMPUS_ID;
}

/**
 * Where "Move to…" can put someone: the other groups of the same kind on
 * their campus, plus groups for every campus. Campus admins only get their
 * own campuses' groups in the first place (N8).
 */
export function moveTargets(
  groups: readonly GroupView[],
  from: Pick<GroupView, "$id" | "kind">,
  person: Pick<GroupMemberView, "campusId">
): GroupView[] {
  return groups.filter(
    (group) =>
      group.$id !== from.$id &&
      group.kind === from.kind &&
      (isCampusWide(group) || group.campus_id === person.campusId)
  );
}

interface MoveMenuProps {
  bigEventId: string;
  /** Names a group's campus when it isn't the person's own. */
  campusLabel: (campusId: string | null) => string;
  from: GroupView;
  person: GroupMemberView;
  targets: GroupView[];
}

/** The per-person menu in a room, buddy group, team or other group. */
export function MoveMenu({
  bigEventId,
  campusLabel,
  from,
  person,
  targets,
}: MoveMenuProps) {
  const t = useTranslations("adminPortal.bigEvents.groups");
  const tb = useTranslations("adminPortal.bigEvents");
  const tp = useTranslations("adminPortal.bigEvents.participants");
  const router = useRouter();
  const { view } = useGroupsTabData();
  const { confirmMove, pending } = useMoveConfirm();
  const { kind } = from;
  if (kind === "bus") {
    return null;
  }

  const save = async (to: GroupView | null, notify: boolean) => {
    try {
      await moveToGroup(bigEventId, {
        groupId: to?.$id ?? null,
        kind,
        notify,
        participantIds: [person.participantId],
      });
      toast.success(
        to
          ? t("moved", { group: to.name, name: person.name })
          : t("takenOut", { group: from.name, name: person.name })
      );
      router.refresh();
    } catch {
      toast.error(tb("form.saveFailed"));
    }
  };

  const label = (group: GroupView) =>
    group.campus_id === person.campusId
      ? group.name
      : `${group.name} · ${campusLabel(group.campus_id)}`;

  /** "Room · Ola Nordmann" for a room, the group's name otherwise. */
  const summary = (to: GroupView | null) => {
    if (!to) {
      return t("takeOut");
    }
    return to.kind === "room" ? tp("roomName", { name: label(to) }) : label(to);
  };

  // After publishing, a room move that changes the person's bus asks first,
  // like a bus move (ruling R14).
  const move = (to: GroupView | null) =>
    confirmMove({
      ask: roomMoveChangesBus(view.groups, to, person),
      names: [person.name],
      run: (notify) => save(to, notify),
      summary: summary(to),
    });

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("personMenu", { name: person.name })}
          className="rounded-md p-1 transition-colors hover:bg-black/5 disabled:opacity-50"
          disabled={pending}
          style={{ color: STUDIO.ink3 }}
          type="button"
        >
          <MoreHorizontal aria-hidden size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
        {targets.length === 0 ? (
          <DropdownMenuItem disabled>{t("noOtherGroups")}</DropdownMenuItem>
        ) : (
          targets.map((group) => (
            <DropdownMenuItem key={group.$id} onSelect={() => move(group)}>
              {label(group)}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => move(null)}>
          {t("takeOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
