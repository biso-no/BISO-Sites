/**
 * Role/team health check — canonical registry of the Appwrite teams the
 * platform must have for authorization, membership, and recruitment to work,
 * plus a pure function that reports which ones are missing.
 *
 * Why this exists: roles are derived entirely from Appwrite team membership
 * (synced from Azure AD security groups). If an operational team is missing
 * — never created, renamed in Azure, or never mirrored into Appwrite — admins
 * silently lose access and there is no developer in the loop to notice. This
 * module lets IT (and an external monitor) verify the teams exist and read an
 * actionable fix for each gap.
 *
 * Team-id convention (deterministic, always lowercase):
 *   - membership:  `biso-members`
 *   - campus:      `sg-app-campus-{city}`        e.g. `sg-app-campus-oslo`
 *   - department:  `sg-app-dept-{name}`          e.g. `sg-app-dept-operationsunit`
 *   - leadership:  `sg-app-dept-ledelsen{city}`  e.g. `sg-app-dept-ledelsenoslo`
 *
 * Pure module — no Appwrite client, no request context, no `"use server"`.
 * The city list is sourced from `@repo/shared/utils/team-roles` so the campus
 * set never drifts from the role-derivation logic. The thin server surface that
 * fetches real teams and feeds them in lives in the admin health route.
 */
import { CAMPUS_CITY_NAMES } from "@repo/shared/utils/team-roles";

export type TeamCategory = "core" | "campus" | "leadership";

export interface RequiredTeam {
  category: TeamCategory;
  /** Operational remediation when the team is missing. */
  fix: string;
  /** Appwrite team `$id` (deterministic, lowercase). */
  id: string;
  /** Human-readable name for the IT health view. */
  label: string;
  /** Why the platform needs this team. */
  purpose: string;
}

export interface TeamHealthEntry extends RequiredTeam {
  present: boolean;
}

export interface TeamHealthReport {
  entries: TeamHealthEntry[];
  missing: TeamHealthEntry[];
  missingCount: number;
  /** True when every required team exists. */
  ok: boolean;
  presentCount: number;
  total: number;
}

const MIRROR_FIX =
  "Ensure the matching Azure AD security group exists and is mirrored into " +
  "Appwrite as a team with this exact id (a member signing in triggers the " +
  "M365 sync that provisions it). Confirm the team in the Appwrite Console " +
  "under Auth → Teams.";

const CORE_TEAMS: RequiredTeam[] = [
  {
    id: "biso-members",
    label: "BISO members",
    category: "core",
    purpose:
      "Grants member-only read access and drives membership discounts in the " +
      "shop. Without it, members lose benefits and discounted pricing.",
    fix: MIRROR_FIX,
  },
  {
    id: "sg-app-campus-national",
    label: "Campus — National",
    category: "core",
    purpose:
      "The campus half of global admin. With Operations Unit it grants " +
      "manage-any-campus authority across the admin and API.",
    fix: MIRROR_FIX,
  },
  {
    id: "sg-app-dept-operationsunit",
    label: "Operations Unit",
    category: "core",
    purpose:
      "The department half of global admin and the Appwrite write backstop " +
      "for content and recruitment rows. Missing it removes every global " +
      "admin and breaks approval routing.",
    fix: MIRROR_FIX,
  },
  {
    id: "sg-app-dept-hr",
    label: "HR",
    category: "core",
    purpose:
      "Recruitment is HR-exclusive — this team holds create and per-row " +
      "access to application, interview, and booking-token tables.",
    fix: MIRROR_FIX,
  },
];

function buildCampusTeams(): RequiredTeam[] {
  const teams: RequiredTeam[] = [];
  for (const city of CAMPUS_CITY_NAMES) {
    const lower = city.toLowerCase();
    teams.push({
      id: `sg-app-campus-${lower}`,
      label: `Campus — ${city}`,
      category: "campus",
      purpose:
        `Campus scoping context for ${city}. Paired with Ledelsen ${city} it ` +
        "makes a campus admin; on its own it scopes a department user's data.",
      fix: MIRROR_FIX,
    });
    teams.push({
      id: `sg-app-dept-ledelsen${lower}`,
      label: `Ledelsen ${city}`,
      category: "leadership",
      purpose:
        `Campus leadership for ${city}. Combined with Campus — ${city} it ` +
        `grants campus-admin rights over ${city} content and shop.`,
      fix: MIRROR_FIX,
    });
  }
  return teams;
}

/**
 * Canonical set of Appwrite teams the platform requires. Ordered core first,
 * then per-city campus + leadership pairs.
 */
export const REQUIRED_TEAMS: readonly RequiredTeam[] = [
  ...CORE_TEAMS,
  ...buildCampusTeams(),
];

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Compare the set of existing Appwrite team ids against {@link REQUIRED_TEAMS}
 * and return a structured health report. Matching is case-insensitive and
 * whitespace-tolerant so it is robust to how the caller collected the ids.
 */
export function checkRequiredTeams(
  existingTeamIds: Iterable<string>
): TeamHealthReport {
  const present = new Set<string>();
  for (const id of existingTeamIds) {
    present.add(normalizeId(id));
  }

  const entries: TeamHealthEntry[] = REQUIRED_TEAMS.map((team) => ({
    ...team,
    present: present.has(team.id),
  }));
  const missing = entries.filter((entry) => !entry.present);

  return {
    ok: missing.length === 0,
    total: entries.length,
    presentCount: entries.length - missing.length,
    missingCount: missing.length,
    entries,
    missing,
  };
}
