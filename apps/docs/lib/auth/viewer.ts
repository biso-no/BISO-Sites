/**
 * The signed-in viewer, read from the admin's Appwrite session cookie.
 *
 * Docs reuses the admin's Microsoft sign-in: the admin sets
 * `a_session_biso_admin` (on `.biso.no` in production), and docs runs with
 * `APPWRITE_SESSION_COOKIE=a_session_biso_admin` so `createSessionClient()`
 * reads it. Docs only reads that cookie. It never sets or clears cookies and
 * never uses the service-key client.
 */
import { Query } from "@repo/api";
import { createSessionClient, getSessionSecret } from "@repo/api/server";
import { type DocsAccess, docsAccessFromTeams } from "./access";

export type Viewer =
  | { signedIn: false }
  | { signedIn: true; name: string; access: DocsAccess };

interface ViewerDeps {
  /** True when the request carries a session cookie at all. */
  hasSession: () => Promise<boolean>;
  loadAccount: () => Promise<{ name: string }>;
  loadTeams: () => Promise<{ $id: string; name: string }[]>;
}

// Appwrite's default page is 25 teams. 200 is far above what any staff member
// belongs to, so access is never decided on a truncated list.
const TEAM_LIMIT = 200;

const defaultDeps: ViewerDeps = {
  async hasSession() {
    return Boolean(await getSessionSecret());
  },
  async loadAccount() {
    const { account } = await createSessionClient();
    const { name } = await account.get();
    return { name };
  },
  async loadTeams() {
    const { teams } = await createSessionClient();
    const list = await teams.list([Query.limit(TEAM_LIMIT)]);
    return list.teams.map(({ $id, name }) => ({ $id, name }));
  },
};

export async function getViewer(
  deps: ViewerDeps = defaultDeps
): Promise<Viewer> {
  // No cookie means signed out. Don't spend an Appwrite call finding that out.
  const hasSession = await deps.hasSession().catch(() => false);
  if (!hasSession) {
    return { signedIn: false };
  }

  let name: string;
  try {
    ({ name } = await deps.loadAccount());
  } catch {
    return { signedIn: false };
  }

  try {
    return {
      signedIn: true,
      name,
      access: docsAccessFromTeams(await deps.loadTeams()),
    };
  } catch {
    return { signedIn: true, name, access: null };
  }
}
