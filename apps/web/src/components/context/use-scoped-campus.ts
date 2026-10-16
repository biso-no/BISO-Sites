"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCampus } from "@/components/context/campus";
import { campusSlugToId, parseCampusParam } from "@/lib/campus-scope";

/** `/campus/<slug>` — the landing page takes its whole scope from the path. */
const CAMPUS_PATH = /^\/campus\/([^/]+)/;

/**
 * The campus the **current page** is showing, resolved the way the routes
 * resolve it: URL first, then the stored preference.
 *
 * The chrome lives in a layout, which can see neither half of the URL, so
 * without this a shared `/events?campus=bergen` listed Bergen events under a
 * header reading "All campuses" — or worse, the reader's own campus. Both the
 * query parameter and the campus landing path are read, because each scopes a
 * page independently of the cookie.
 *
 * `?campus=` is parsed with the same parser the routes use rather than
 * `campusSlugToId` alone, so three cases survive: `all`, which is an
 * authoritative "no filter" and must not fall through to the cookie; a numeric
 * id, which older links carry; and an unrecognised value, where the page 404s
 * and the label is moot.
 *
 * **Calls `useSearchParams`, so every caller must sit inside a `<Suspense>`
 * boundary** — otherwise it takes the whole prerendered shell dynamic and gives
 * back the FCP the redesign bought.
 */
export function useScopedCampusId(): string | null {
  const { activeCampusId } = useCampus();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const parsed = parseCampusParam(searchParams.get("campus") ?? undefined);
  if (parsed.kind === "campus") {
    return parsed.id;
  }
  if (parsed.kind === "all") {
    return null;
  }

  const fromPath = CAMPUS_PATH.exec(pathname)?.[1] ?? null;
  if (fromPath) {
    return campusSlugToId(fromPath) ?? activeCampusId;
  }
  return activeCampusId;
}
