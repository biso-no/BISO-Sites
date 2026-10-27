"use client";

import { MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { Container } from "@/components/ui/container";
import { campusIdToSlug } from "@/lib/campus-scope";

/**
 * The home hero, and **the project's one orchestrated motion moment**.
 *
 * The sheared photo panels wipe in along the chevron axis in sequence on first
 * paint, once. The motion budget for the entire site is: this, motion that
 * answers a user action, and state transitions — nothing else
 * (`01-design-spec.md` §1.9). Under `prefers-reduced-motion` the panels render
 * with no animation at all.
 *
 * **The collage is the campus's face.** Per §7.4 the chevron is a container for
 * identity rather than decoration: the panels show the campus you are on, so
 * "you are on Campus Oslo" is something you see rather than only read. That is
 * the whole reason campus needed a URL (RD-016).
 *
 * The campus arrives from the page, which resolves it the way every feed does
 * (`?campus=` > cookie > all), so the headline names the same campus the
 * sections below are scoped to — including on a shared `/?campus=bergen` link
 * opened by someone whose cookie says otherwise. The live counts that used to
 * sit here moved to the overview section with the rest of the campus overview
 * (Branding Committee, batch G); the headline is the campus, not a sparkle
 * pill.
 */
const PANEL_COUNT = 3;
const STAGGER_MS = 110;
const MS = 1000;

/**
 * Campuses with a photo in `public/images/campus/`, in display order. National
 * has none: it is a scope, not a place.
 */
const CAMPUS_PHOTOS = ["oslo", "bergen", "trondheim", "stavanger"];

export interface HeroCampus {
  id: string;
  name: string;
}

export interface HeroChevronProps {
  /**
   * The campus the page is scoped to. `null` for every campus — and for
   * National, which counts as "no campus" for this copy.
   */
  campus: HeroCampus | null;
  /** "View events", scoped like the page. */
  eventsHref: string;
  /**
   * A member is not asked to join (the header's rule too): their primary
   * action is the member portal.
   */
  isMember: boolean;
}

const PRIMARY_CTA =
  "type-body-sm inline-flex items-center rounded-biso-pill bg-action px-5 py-2.5 font-semibold text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const SECONDARY_CTA =
  "type-body-sm inline-flex items-center rounded-biso-pill border border-edge px-5 py-2.5 text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function HeroChevron({
  campus,
  eventsHref,
  isMember,
}: HeroChevronProps) {
  const t = useTranslations("home.hero");
  const tNav = useTranslations("common.navigation");
  const prefersReduced = useReducedMotion();

  const campusName = campus?.name;
  const slug = campusIdToSlug(campus?.id);

  // Campus photos are the only real imagery available: one panel for the
  // campus you are on, otherwise the campuses side by side.
  const ownPhoto = slug && CAMPUS_PHOTOS.includes(slug) ? slug : null;
  const images = (
    ownPhoto ? [ownPhoto] : CAMPUS_PHOTOS.slice(0, PANEL_COUNT)
  ).map((photo) => `/images/campus/${photo}.png`);

  return (
    <section className="relative overflow-hidden" data-surface="deep">
      <div className="bg-surface pt-[calc(5rem+var(--section-y))] pb-(--section-y)">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            {/* `min-w-0` matters: a display word like "STUDENTSTEMME" at 104px
                has a huge intrinsic minimum, and without this the column refuses
                to shrink and shoves the collage past the viewport edge. */}
            <div className="min-w-0">
              <h1 className="type-display-hero max-w-[16ch] text-ink">
                {campusName ? t("titleActive") : t("titleDefault")}
              </h1>

              <p className="type-body type-measure mt-6 text-ink-muted">
                {campusName
                  ? t("subtitleActive", { campusName })
                  : t("subtitleDefault")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {isMember ? (
                  <Link className={PRIMARY_CTA} href="/member">
                    {tNav("memberPortal")}
                  </Link>
                ) : (
                  <Link className={PRIMARY_CTA} href="/membership">
                    {t("ctas.join")}
                  </Link>
                )}
                <Link className={SECONDARY_CTA} href={eventsHref}>
                  {t("ctas.viewEvents")}
                </Link>
              </div>

              {/* The design states the campus rather than only filtering by it —
                  and now it links somewhere, which is what makes the claim honest. */}
              <p className="type-label mt-8 flex flex-wrap items-center gap-2 text-ink-muted">
                <MapPin aria-hidden="true" className="size-4 text-ink-accent" />
                {campusName ? (
                  <>
                    <span>{tNav("campus")}</span>
                    <Link
                      className="text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      href={slug ? `/campus/${slug}` : "/campus"}
                    >
                      {campusName}
                    </Link>
                  </>
                ) : (
                  <Link
                    className="text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    href="/campus"
                  >
                    {t("primaryCtaSecondary")}
                  </Link>
                )}
              </p>
            </div>

            {/* The collage. Alternating lean gives the chevron its direction. */}
            <ul className="hidden gap-2 lg:flex">
              {images.map((src, index) => (
                <motion.li
                  animate={prefersReduced ? undefined : { opacity: 1, x: 0 }}
                  initial={prefersReduced ? undefined : { opacity: 0, x: 28 }}
                  key={src}
                  transition={{
                    duration: 0.42,
                    delay: (index * STAGGER_MS) / MS,
                    ease: [0.2, 0, 0, 1],
                  }}
                >
                  <ChevronFrame
                    className="w-28 xl:w-36"
                    lean={index % 2 === 1 ? "right" : "left"}
                    ratio="4/5"
                  >
                    <Image
                      alt=""
                      height={600}
                      sizes="(max-width: 1280px) 112px, 144px"
                      src={src}
                      width={480}
                    />
                  </ChevronFrame>
                </motion.li>
              ))}
            </ul>
          </div>
        </Container>
      </div>
    </section>
  );
}
