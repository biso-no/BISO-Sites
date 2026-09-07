import { cacheLife } from "next/cache";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";

/**
 * Campus leadership, read from `apps/api`'s Azure AD board endpoint.
 *
 * **Restored after PR review.** The v1 campus page had a "Management" /
 * "Ledelsen" tab backed by this endpoint; RD-023 rebuilt the page as a single
 * scroll and the tab went with the tabs. The redesign's audit recorded the
 * `department_board` *table* as empty (PLACEHOLDER-010) and concluded there was
 * no board data — but this feature never read that table. It reads live people
 * out of Azure AD through Microsoft Graph, and it still returns them.
 *
 * The response carries base64 portraits. `apps/api` now asks Graph for a
 * bounded thumbnail rather than the original upload, which took Oslo's board
 * from 25 MB to 382 KB; without that this could not be rendered on a page at
 * all. It is still large enough to want caching and its own Suspense boundary.
 */
export interface BoardMember {
  email: string | null;
  imageUrl: string | null;
  name: string;
  phone: string | null;
  position: string | null;
}

export interface BoardSection {
  members: BoardMember[];
  title: string;
}

/** Azure AD department that holds each campus's management. */
const MANAGEMENT_DEPARTMENT_IDS: Record<string, string> = {
  "1": "2",
  "2": "301",
  "3": "601",
  "4": "801",
  "5": "1002",
};

/**
 * National leadership is not one board: it is split across the Operations Unit
 * and three committees, each rendered under its own heading. The segments are
 * literal Azure department names except the first, which resolves through a
 * `departments` row id.
 */
const NATIONAL_GROUPS: {
  segment: string;
  title: { en: string; no: string };
}[] = [
  {
    segment: MANAGEMENT_DEPARTMENT_IDS[NATIONAL_CAMPUS_ID],
    title: { en: "Operations Unit", no: "Operations Unit" },
  },
  {
    segment: "Administration",
    title: { en: "Administration", no: "Administrasjon" },
  },
  {
    segment: "Control Committee",
    title: { en: "Control Committee", no: "Kontrollkomiteen" },
  },
  {
    segment: "Branding Committee",
    title: { en: "Branding Committee", no: "Brandingkomiteen" },
  },
];

interface BoardResponse {
  members?: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    profilePhotoUrl?: string | null;
    role?: string | null;
  }[];
  success?: boolean;
}

async function fetchBoard(
  campusId: string,
  segment: string
): Promise<BoardMember[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    return [];
  }

  const response = await fetch(
    `${base}/api/campus/${campusId}/${encodeURIComponent(segment)}/board`,
    { headers: { "Content-Type": "application/json" } }
  );
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as BoardResponse;
  if (!data.success) {
    return [];
  }

  return (data.members ?? [])
    .filter((member) => member.name)
    .map((member) => ({
      name: member.name as string,
      position: member.role ?? null,
      email: member.email ?? null,
      phone: member.phone ?? null,
      imageUrl: member.profilePhotoUrl ?? null,
    }));
}

/**
 * Every leadership group for a campus, in render order.
 *
 * `apps/api` is a separate service: if it is down or Azure is unreachable this
 * returns an empty list and the caller omits the section, rather than failing
 * the whole campus page for a block that sits below the fold.
 */
export async function campusLeadership(
  campusId: string,
  locale: "en" | "no"
): Promise<BoardSection[]> {
  "use cache";
  cacheLife("hours");

  try {
    if (campusId === NATIONAL_CAMPUS_ID) {
      const groups = await Promise.all(
        NATIONAL_GROUPS.map(async (group) => ({
          title: group.title[locale],
          members: await fetchBoard(campusId, group.segment).catch(() => []),
        }))
      );
      return groups.filter((group) => group.members.length > 0);
    }

    const segment = MANAGEMENT_DEPARTMENT_IDS[campusId];
    if (!segment) {
      return [];
    }
    const members = await fetchBoard(campusId, segment);
    return members.length > 0 ? [{ title: "", members }] : [];
  } catch {
    return [];
  }
}
