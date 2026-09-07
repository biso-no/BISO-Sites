import { Mail, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { StatRow } from "@/components/ui/stat-row";
import { cachedCampuses, cachedHomeCounts } from "@/lib/data/public-content";
import { FooterSocial } from "./footer-social";

/**
 * The redesign's footer. A Server Component — the old one was `"use client"`
 * only because it called `useTranslations` and ran five `whileInView` reveals,
 * so it shipped its whole markup to the browser for no interactive behaviour.
 * The one genuinely client-side part, tracked outbound social links, is a
 * separate island (`footer-social.tsx`).
 *
 * Fixes carried from 00-current-state.md §8.5:
 *   - internal links were `<a>`, so every footer click was a full page reload
 *   - body copy measured 4.18:1, below AA
 *   - social buttons were `bg-inverted` on a `bg-inverted` footer: invisible
 *     until hover, and hovered to an off-brand purple/pink gradient
 *   - five scroll-triggered reveals, the pattern the brief asks to remove
 *
 * **PLACEHOLDER-004.** The reference shows "1000+ Active Members". Member
 * counts are not public data and `cachedHomeCounts` does not expose them, so
 * that tile is omitted rather than invented. Every figure below is a real
 * count; a tile is dropped entirely when its source returns nothing.
 */
async function footerStats(): Promise<{ value: string; label: string }[]> {
  const t = await getTranslations("common.footer.stats");

  // Both readers are `"use cache"`, so the footer costs a cache lookup per page
  // rather than a query. Failures degrade to fewer tiles, never to a guess.
  const [counts, campuses] = await Promise.all([
    cachedHomeCounts(null).catch(() => null),
    cachedCampuses(null, false, true).catch(() => []),
  ]);

  const societies = campuses.reduce(
    (total, campus) => total + (campus.departments?.length ?? 0),
    0
  );

  const stats: { value: string; label: string }[] = [];
  if (societies > 0) {
    stats.push({ value: String(societies), label: t("societies") });
  }
  if (counts && counts.eventCount > 0) {
    stats.push({ value: String(counts.eventCount), label: t("events") });
  }
  if (counts && counts.jobCount > 0) {
    stats.push({ value: String(counts.jobCount), label: t("positions") });
  }
  if (campuses.length > 0) {
    stats.push({ value: String(campuses.length), label: t("campuses") });
  }
  return stats;
}

export async function FooterV2() {
  const [t, tCommon, stats] = await Promise.all([
    getTranslations("common.footer"),
    getTranslations("common"),
    footerStats(),
  ]);

  const columns = [
    {
      id: "about",
      heading: t("headings.about"),
      links: [
        { label: t("about.ourStory"), href: "/about/history" },
        { label: t("about.contact"), href: "/contact" },
      ],
    },
    {
      id: "students",
      heading: t("headings.students"),
      links: [
        { label: t("students.membership"), href: "/membership" },
        { label: t("students.events"), href: "/events" },
        { label: t("students.news"), href: "/news" },
        { label: t("students.resources"), href: "/resources" },
      ],
    },
    {
      id: "practical",
      heading: t("headings.practical"),
      links: [
        { label: "BI", href: "https://bi.no" },
        { label: tCommon("codeOfConduct"), href: "/safety#code-of-conduct" },
        { label: t("support.privacyPolicy"), href: "/privacy" },
        { label: t("support.termsOfService"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer
      className="bg-surface text-ink"
      // Flips --ink, --edge and --action to their on-navy values, so nothing
      // below has to know which surface it sits on.
      data-surface="deep"
    >
      <Container className="py-(--section-y)">
        <p className="type-display-sm max-w-[14ch] text-ink">{t("tagline")}</p>

        {stats.length > 0 && (
          <StatRow className="mt-8 border-edge border-t pt-8" stats={stats} />
        )}

        <div className="mt-10 grid gap-10 border-edge border-t pt-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <Image
                alt=""
                height={40}
                src="/images/logo-dark.png"
                width={40}
              />
              <span>
                <span className="type-heading-card block text-ink">BISO</span>
                <span className="type-body-sm block text-ink-muted">
                  BI Student Organisation
                </span>
              </span>
            </div>
            <p className="type-body max-w-(--measure) text-ink-muted">
              {t("about.description")}
            </p>
            <address className="mt-5 space-y-2 not-italic">
              <span className="type-body-sm flex items-start gap-3 text-ink-muted">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                Nydalsveien 37, 0484 Oslo, Norway
              </span>
              <a
                className="type-body-sm flex items-center gap-3 text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                href="mailto:contact@biso.no"
              >
                <Mail aria-hidden="true" className="size-5 shrink-0" />
                contact@biso.no
              </a>
            </address>
          </div>

          {columns.map((column) => (
            <nav aria-label={column.heading} key={column.id}>
              <h2 className="type-label mb-4 text-ink">{column.heading}</h2>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 border-edge border-t pt-8 sm:flex-row sm:items-center">
          <p className="type-body-sm text-ink-muted">
            © {new Date().getFullYear()} BI Student Organisation
          </p>
          <FooterSocial />
        </div>
      </Container>
    </footer>
  );
}

/** Internal hrefs route client-side; external ones keep `<a>` with the rel. */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const className =
    "type-body-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

  if (href.startsWith("http")) {
    return (
      <a
        className={className}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
