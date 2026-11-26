import "server-only";

import { type Models, Query } from "@repo/api";
import {
  type Audience,
  resolveAudience,
} from "@repo/shared/big-events/messages/audience";
import {
  deliveryRecipients,
  type PlannedRecipient,
  planDelivery,
  type RecipientAccount,
} from "@repo/shared/big-events/messages/plan";
import {
  BIG_EVENT_TABLES,
  type GroupLeg,
} from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import {
  messageCampusIds,
  participantCampusFilter,
} from "@/lib/big-events/access";
import type { AdminDb, GrantedAccess } from "@/lib/big-events/action-helpers";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import { getPushReach } from "@/lib/big-events/reach.server";

/**
 * Who a message from the caller reaches and how (plans M3, M5, M7), for the
 * preview and the checks before sending. The send itself works it out again
 * from the stored message (`@repo/shared/big-events/messages/load`), with
 * the same rules.
 */

const USER_TABLE = "user";
const PERSON_COLUMNS = [
  "$id",
  "campus_id",
  "first_name",
  "phone",
  "ticket_email",
  "user_id",
];
const MEMBER_COLUMNS = ["$id", "group_id", "leg", "participant_id"];

type AccountRow = Models.Row & RecipientAccount;

export interface AudienceData {
  buses: Map<string, BigEventGroupRow>;
  members: BigEventGroupMemberRow[];
  /** Only the people the caller may see (spec D2). */
  participants: BigEventParticipantRow[];
  rooms: Map<string, BigEventGroupRow>;
}

export async function loadAudienceData(
  db: AdminDb,
  bigEventId: string,
  access: GrantedAccess
): Promise<AudienceData> {
  const inEvent = Query.equal("big_event_id", [bigEventId]);
  const [participants, groups, members] = await Promise.all([
    listAllRows<BigEventParticipantRow>(db, BIG_EVENT_TABLES.participants, [
      inEvent,
      ...participantCampusFilter(access),
      Query.select(PERSON_COLUMNS),
    ]),
    listAllRows<BigEventGroupRow>(db, BIG_EVENT_TABLES.groups, [inEvent]),
    listAllRows<BigEventGroupMemberRow>(db, BIG_EVENT_TABLES.groupMembers, [
      inEvent,
      Query.select(MEMBER_COLUMNS),
    ]),
  ]);
  const ofKind = (kind: BigEventGroupRow["kind"]) =>
    new Map(
      groups
        .filter((group) => group.kind === kind)
        .map((group) => [group.$id, group])
    );
  return { buses: ofKind("bus"), members, participants, rooms: ofKind("room") };
}

/**
 * The people `audience` reaches within the caller's campuses (ruling R22),
 * in id order: the same cut the send makes with the message's `campus_ids`.
 */
export function reachedPeople(
  data: AudienceData,
  audience: Audience,
  access: GrantedAccess
): BigEventParticipantRow[] {
  const campuses = messageCampusIds(access);
  const ids = resolveAudience({
    allowedCampusIds: campuses.length > 0 ? campuses : "all",
    audience,
    buses: data.buses,
    members: data.members,
    participants: data.participants,
  });
  const byId = new Map(data.participants.map((person) => [person.$id, person]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * How each person would get the message (plan M3), built the way the send
 * builds it (`deliveryRecipients`); only push reach differs: it comes from
 * the cached lookup the Participants tab uses.
 */
export async function planRecipients(
  db: AdminDb,
  data: AudienceData,
  people: BigEventParticipantRow[],
  options: { important: boolean; leg: GroupLeg; sms: boolean }
): Promise<PlannedRecipient[]> {
  const linked = [...new Set(people.flatMap((person) => person.user_id ?? []))];
  const [accounts, pushUsers] = await Promise.all([
    listRowsByIds<AccountRow>(db, USER_TABLE, "$id", linked, [
      Query.select(["$id", "email", "locale"]),
    ]),
    getPushReach(linked),
  ]);
  return planDelivery({
    important: options.important,
    pushUsers,
    recipients: deliveryRecipients({
      accounts,
      buses: data.buses,
      leg: options.leg,
      members: data.members,
      people,
      rooms: data.rooms,
    }),
    sms: options.sms,
  });
}
