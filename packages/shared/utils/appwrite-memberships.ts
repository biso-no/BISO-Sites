import { Query } from "@repo/api";

const MEMBERSHIP_PAGE_SIZE = 100;
const MEMBERSHIP_MAX_PAGES = 20;

export interface UserMembershipRow {
  $id: string;
  teamId: string;
}

export interface UserMembershipLister {
  listMemberships(params: {
    userId: string;
    queries?: string[];
  }): Promise<{ memberships: UserMembershipRow[]; total: number }>;
}

/**
 * Collect every team membership for a user. Appwrite list reads default to 25
 * rows, which silently truncates role/offboarding logic for users in many
 * teams (PR-075) — always paginate to the full set.
 */
export async function listAllUserMemberships(
  users: UserMembershipLister,
  userId: string
): Promise<UserMembershipRow[]> {
  const memberships: UserMembershipRow[] = [];

  for (let page = 0; page < MEMBERSHIP_MAX_PAGES; page++) {
    const { memberships: rows, total } = await users.listMemberships({
      userId,
      queries: [
        Query.limit(MEMBERSHIP_PAGE_SIZE),
        Query.offset(page * MEMBERSHIP_PAGE_SIZE),
      ],
    });
    memberships.push(...rows);

    if (memberships.length >= total || rows.length < MEMBERSHIP_PAGE_SIZE) {
      break;
    }
  }

  return memberships;
}
