/**
 * Members panel — the identify() payoff.
 *
 * PLAIN, server-only module (NOT "use server"). The web app calls
 * `umami.identify(<Appwrite account $id>, …)`, so identified Umami sessions are
 * keyed by an Appwrite account `$id`. Here we group those sessions by their
 * `distinctId`, then resolve each `$id` to a real display name via the Appwrite
 * Admin `users.get($id)` lookup. Names are resolved server-side ONLY and are
 * never sent back to Umami.
 *
 * Every lookup is defensive: a `distinctId` may be a non-identified visitor or a
 * deleted user, so failures degrade to "Unknown" and the panel degrades to an
 * empty list if the sessions endpoint/shape is not as expected.
 */

import "server-only";

import { createAdminClient } from "@repo/api/server";
import { fetchSessions, type UmamiRange } from "./client";

const MAX_MEMBERS = 12;
const UNKNOWN_NAME = "Unknown";

export interface MemberPanelRow {
  /** Appwrite account $id (Umami distinctId). */
  id: string;
  name: string;
  views: number;
  visits: number;
}

interface Aggregate {
  views: number;
  visits: number;
}

function emailLocalPart(email: string | undefined): string | null {
  if (!email) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : null;
}

/**
 * Build the Members panel: identified sessions grouped by Appwrite account $id,
 * resolved to display names, ranked by visit count. Returns an empty list on any
 * failure or when no sessions are identified.
 */
export async function fetchMembersPanel(
  range: UmamiRange
): Promise<MemberPanelRow[]> {
  const sessions = await fetchSessions(range);

  // Group identified sessions by Appwrite account $id (distinctId).
  const grouped = new Map<string, Aggregate>();
  for (const session of sessions) {
    const id = session.distinctId?.trim();
    if (!id) {
      continue;
    }
    const current = grouped.get(id) ?? { views: 0, visits: 0 };
    current.views += session.views ?? 0;
    current.visits += session.visits ?? 0;
    grouped.set(id, current);
  }

  if (grouped.size === 0) {
    return [];
  }

  const ranked = [...grouped.entries()]
    .sort((a, b) => b[1].visits - a[1].visits || b[1].views - a[1].views)
    .slice(0, MAX_MEMBERS);

  let users: Awaited<ReturnType<typeof createAdminClient>>["users"];
  try {
    ({ users } = await createAdminClient());
  } catch (error) {
    console.error(
      "[Umami] Could not init admin client for member names:",
      error
    );
    return ranked.map(([id, agg]) => ({
      id,
      name: UNKNOWN_NAME,
      views: agg.views,
      visits: agg.visits,
    }));
  }

  return await Promise.all(
    ranked.map(async ([id, agg]) => {
      let name = UNKNOWN_NAME;
      try {
        const user = await users.get(id);
        name = user.name?.trim() || emailLocalPart(user.email) || UNKNOWN_NAME;
      } catch {
        // Non-identified visitor or deleted user — leave as Unknown.
      }
      return { id, name, views: agg.views, visits: agg.visits };
    })
  );
}
