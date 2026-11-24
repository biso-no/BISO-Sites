import type { MetadataRoute } from "next";
import { CAMPUS_SLUGS } from "@/lib/campus-scope";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

export interface StaticSitemapRoute {
  changeFrequency: ChangeFrequency;
  path: string;
  priority: number;
  /** A redirect into another page: in the sitemap, but not a page of its own. */
  redirect?: boolean;
}

// The other former subpages redirect into sections of /about.
const ABOUT_SUBROUTES = ["drugs-policy", "academics-contact"];

/**
 * Every page written in code that the sitemap lists, in sitemap order.
 *
 * **No `?campus=` feed variants.** They were listed here at first, which
 * contradicted the pages themselves: `/events`, `/news` and `/jobs` each
 * hard-canonical every scoped request back to the unscoped feed, so a
 * sitemap entry for `/events?campus=bergen` tells a crawler "index this"
 * and the page it lands on replies "no, index /events instead". Caught in
 * PR review. The canonical is the half worth keeping — a scoped feed is a
 * filtered view of the same collection and should not compete with the
 * listing it filters — so the sitemap entries go.
 *
 * The campus *landing* pages stay: they self-canonical, and each is a
 * distinct page rather than a filtered view. `/units` and `/shop` also
 * accept `?campus=` and are likewise unlisted; `/units` already has all
 * 141 of its `/units/<campus>/<slug>` pages, which is the campus-specific
 * content a crawler actually wants. `/projects` has no campus_id and cannot
 * be scoped at all.
 */
export const STATIC_SITEMAP_ROUTES: readonly StaticSitemapRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/jobs", changeFrequency: "daily", priority: 0.9 },
  { path: "/events", changeFrequency: "daily", priority: 0.8 },
  { path: "/news", changeFrequency: "daily", priority: 0.7 },
  { path: "/shop", changeFrequency: "daily", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/documents", changeFrequency: "monthly", priority: 0.5 },
  { path: "/campus", changeFrequency: "weekly", priority: 0.6 },
  { path: "/membership", changeFrequency: "monthly", priority: 0.6 },
  { path: "/business", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/units", changeFrequency: "weekly", priority: 0.6 },
  { path: "/students", changeFrequency: "weekly", priority: 0.6 },
  { path: "/projects", changeFrequency: "weekly", priority: 0.6 },
  { path: "/okonomisk-stotte", changeFrequency: "monthly", priority: 0.5 },
  { path: "/resources", changeFrequency: "monthly", priority: 0.5 },
  { path: "/business-hotspot", changeFrequency: "monthly", priority: 0.4 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.4 },
  { path: "/press", changeFrequency: "monthly", priority: 0.3 },
  ...ABOUT_SUBROUTES.map((slug) => ({
    path: `/about/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.4,
    redirect: true,
  })),
  ...CAMPUS_SLUGS.map((slug) => ({
    path: `/campus/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  })),
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

/** The sitemap's own pages: the routes above minus the /about redirects. */
export const STATIC_SITEMAP_PATHS: readonly string[] =
  STATIC_SITEMAP_ROUTES.filter((route) => !route.redirect).map(
    (route) => route.path
  );
