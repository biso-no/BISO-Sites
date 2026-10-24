import { managementDepartmentId } from "@/lib/campus-leadership";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { cachedUnitBoard, type UnitBoardMember } from "@/lib/data/unit-board";

/**
 * A campus's management board, as the campus landing renders it.
 *
 * The people come from Microsoft 365 through `apps/api`'s board endpoint — the
 * same live directory the v1 "Management" tab and the front page's leadership
 * section read. This module only decides WHICH boards make up a campus's
 * leadership; the reads go through `cachedUnitBoard`, so every board is one
 * cache entry shared with the unit pages and the front page.
 *
 * Deliberately NOT a `"use cache"` entry itself. `cachedUnitBoard` throws on a
 * transient failure so that an outage is never cached as "this campus has no
 * board"; the fallback for National's per-committee reads therefore lives here,
 * outside every cache entry, where an empty group lasts for this render only.
 * A single campus board is left to throw, and the page catches it — the
 * section is then omitted rather than the page failing.
 */
export interface BoardMember {
  email: string | null;
  imageUrl: string | null;
  name: string;
  phone: string | null;
  position: string | null;
}

/** National's leadership groups; `null` is a campus's one management board. */
export type LeadershipGroupKey =
  | "operations"
  | "administration"
  | "controlCommittee"
  | "brandingCommittee";

export interface BoardSection {
  /** Translated by the landing under `campus.leadership.groups.*`. */
  key: LeadershipGroupKey | null;
  members: BoardMember[];
}

interface LeadershipGroup {
  key: LeadershipGroupKey;
  segment: string;
}

/**
 * National leadership is not one board: it is split across the Operations
 * Unit and three committees, each rendered under its own heading. The
 * Operations Unit resolves through its `departments` row id — main's
 * `MANAGEMENT_DEPARTMENT_IDS`, the same map the front page reads — and the
 * committees are literal Azure AD department names, which the board endpoint
 * matches directly.
 */
const NATIONAL_COMMITTEES: LeadershipGroup[] = [
  { key: "administration", segment: "Administration" },
  { key: "controlCommittee", segment: "Control Committee" },
  { key: "brandingCommittee", segment: "Branding Committee" },
];

function nationalGroups(): LeadershipGroup[] {
  const operations = managementDepartmentId(NATIONAL_CAMPUS_ID);
  return operations
    ? [{ key: "operations", segment: operations }, ...NATIONAL_COMMITTEES]
    : NATIONAL_COMMITTEES;
}

function toBoardMember(member: UnitBoardMember): BoardMember {
  return {
    email: member.email,
    imageUrl: member.imageUrl,
    name: member.name,
    phone: member.phone ?? null,
    position: member.role,
  };
}

async function boardMembers(
  campusId: string,
  segment: string
): Promise<BoardMember[]> {
  const members = await cachedUnitBoard(campusId, segment);
  return members.map(toBoardMember);
}

/**
 * Every leadership group for a campus, in render order.
 *
 * THROWS when a single campus's board cannot be read — the caller supplies the
 * fallback. National's groups each fall back on their own, so one committee's
 * directory failing never hides the others.
 */
export async function campusLeadership(
  campusId: string
): Promise<BoardSection[]> {
  if (campusId === NATIONAL_CAMPUS_ID) {
    const groups = await Promise.all(
      nationalGroups().map(async (group) => ({
        key: group.key,
        members: await boardMembers(campusId, group.segment).catch(() => []),
      }))
    );
    return groups.filter((group) => group.members.length > 0);
  }

  const segment = managementDepartmentId(campusId);
  if (!segment) {
    return [];
  }
  const members = await boardMembers(campusId, segment);
  return members.length > 0 ? [{ key: null, members }] : [];
}
