/**
 * Who a big event message reaches (plan M7). Pure module (no Appwrite).
 *
 * Campus admins reach only their campus's participants (spec D2): every
 * audience is cut down to `allowedCampusIds`, so "everyone" from a campus
 * admin means everyone on their campus.
 */

import type { GroupLeg } from "../tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "../types";

export type Audience =
  | { type: "everyone" }
  | { type: "campus"; campusIds: string[] }
  | { type: "groups"; groupIds: string[]; leg?: GroupLeg }
  | { type: "people"; participantIds: string[] };

export type AudienceMember = Pick<
  BigEventGroupMemberRow,
  "group_id" | "leg" | "participant_id"
>;

export type AudienceParticipant = Pick<
  BigEventParticipantRow,
  "$id" | "campus_id"
>;

export interface ResolveAudienceInput {
  /** `"all"` for full access; otherwise only people on these campuses. */
  allowedCampusIds: string[] | "all";
  audience: Audience;
  /** Bus groups by id; a seat counts only on a bus of the person's campus. */
  buses: ReadonlyMap<string, Pick<BigEventGroupRow, "campus_id">>;
  members: AudienceMember[];
  participants: AudienceParticipant[];
}

/**
 * Bus seats count only on the message's leg (the way out when none is
 * chosen, plan M5) and only on a bus of the person's own campus (nobody is
 * messaged about another campus's bus, Stage 2 R19); a seat on a bus that no
 * longer exists counts for nobody. Places in rooms, buddy groups and teams
 * have no leg and always count.
 */
function groupMemberIds(
  input: ResolveAudienceInput,
  groupIds: string[],
  leg: GroupLeg = "out"
): Set<string> {
  const groups = new Set(groupIds);
  const campusOf = new Map(
    input.participants.map((participant) => [
      participant.$id,
      participant.campus_id,
    ])
  );
  const ids = new Set<string>();
  for (const member of input.members) {
    if (!groups.has(member.group_id)) {
      continue;
    }
    if (member.leg === null) {
      ids.add(member.participant_id);
      continue;
    }
    const bus = input.buses.get(member.group_id);
    const ownCampusBus =
      bus !== undefined &&
      campusOf.has(member.participant_id) &&
      bus.campus_id === campusOf.get(member.participant_id);
    if (member.leg === leg && ownCampusBus) {
      ids.add(member.participant_id);
    }
  }
  return ids;
}

function audienceMatcher(
  input: ResolveAudienceInput
): (participant: AudienceParticipant) => boolean {
  const { audience } = input;
  switch (audience.type) {
    case "everyone":
      return () => true;
    case "campus": {
      const campuses = new Set(audience.campusIds);
      return (participant) =>
        participant.campus_id !== null && campuses.has(participant.campus_id);
    }
    case "groups": {
      const ids = groupMemberIds(input, audience.groupIds, audience.leg);
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
  const inAudience = audienceMatcher(input);
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
