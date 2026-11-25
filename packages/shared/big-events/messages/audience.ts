/**
 * Who a big event message reaches (plan M7). Pure module (no Appwrite).
 *
 * Campus admins reach only their campus's participants (spec D2): every
 * audience is cut down to `allowedCampusIds`, so "everyone" from a campus
 * admin means everyone on their campus.
 */

import type { GroupLeg } from "../tables";
import type { BigEventGroupMemberRow, BigEventParticipantRow } from "../types";

export type Audience =
  | { type: "everyone" }
  | { type: "campus"; campusIds: string[] }
  | { type: "groups"; groupIds: string[]; leg?: GroupLeg }
  | { type: "people"; participantIds: string[] };

export type AudienceMember = Pick<
  BigEventGroupMemberRow,
  "group_id" | "leg" | "participant_id"
>;

export interface ResolveAudienceInput {
  /** `"all"` for full access; otherwise only people on these campuses. */
  allowedCampusIds: string[] | "all";
  audience: Audience;
  members: AudienceMember[];
  participants: Pick<BigEventParticipantRow, "$id" | "campus_id">[];
}

/**
 * Bus seats count only on the message's leg (the way out when none is
 * chosen, plan M5); places in rooms, buddy groups and teams have no leg and
 * always count.
 */
function groupMemberIds(
  members: AudienceMember[],
  groupIds: string[],
  leg: GroupLeg = "out"
): Set<string> {
  const groups = new Set(groupIds);
  const ids = new Set<string>();
  for (const member of members) {
    if (
      groups.has(member.group_id) &&
      (member.leg === null || member.leg === leg)
    ) {
      ids.add(member.participant_id);
    }
  }
  return ids;
}

function audienceMatcher(
  audience: Audience,
  members: AudienceMember[]
): (participant: Pick<BigEventParticipantRow, "$id" | "campus_id">) => boolean {
  switch (audience.type) {
    case "everyone":
      return () => true;
    case "campus": {
      const campuses = new Set(audience.campusIds);
      return (participant) =>
        participant.campus_id !== null && campuses.has(participant.campus_id);
    }
    case "groups": {
      const ids = groupMemberIds(members, audience.groupIds, audience.leg);
      return (participant) => ids.has(participant.$id);
    }
    case "people": {
      const ids = new Set(audience.participantIds);
      return (participant) => ids.has(participant.$id);
    }
    default:
      return () => false;
  }
}

/** The participant ids the audience reaches within the caller's campuses: deduped and sorted. */
export function resolveAudience(input: ResolveAudienceInput): string[] {
  const { allowedCampusIds } = input;
  const allowed = allowedCampusIds === "all" ? null : new Set(allowedCampusIds);
  const inAudience = audienceMatcher(input.audience, input.members);
  const ids = new Set<string>();
  for (const participant of input.participants) {
    const onAllowedCampus =
      allowed === null ||
      (participant.campus_id !== null && allowed.has(participant.campus_id));
    if (onAllowedCampus && inAudience(participant)) {
      ids.add(participant.$id);
    }
  }
  return [...ids].sort();
}
