"use client";

import { MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCampus } from "@/components/context/campus";
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
 */
const PANEL_COUNT = 3;
const STAGGER_MS = 110;
const MS = 1000;

export interface HeroChevronProps {
  eventCount: number;
  jobCount: number;
}

export function HeroChevron({ eventCount, jobCount }: HeroChevronProps) {
  const t = useTranslations("home.hero");
  const tNav = useTranslations("common.navigation");
  const { activeCampus, campuses } = useCampus();
  const prefersReduced = useReducedMotion();

  const campusName = activeCampus?.name;
  const slug = campusIdToSlug(activeCampus?.$id);

  // Campus photos are the only real imagery available; a campus with none
  // falls back to the shared hero image rather than an invented placeholder.
  const panels = (
    campusName
      ? [`/images/campus/${campusName.toLowerCase()}.png`]
      : campuses
          .map((c) => `/images/campus/${c.name.toLowerCase()}.png`)
          .slice(0, PANEL_COUNT)
  ).slice(0, PANEL_COUNT);
  const images = panels.length > 0 ? panels : ["/images/hero-bg.png"];

  return (
    <section className="relative overflow-hidden" data-surface="deep">
      <div className="bg-surface pt-[calc(5rem+var(--section-y))] pb-(--section-y)">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            {/* `min-w-0` matters: a display word like "STUDENTSTEMME" at 104px
                has a huge intrinsic minimum, and without this the column refuses
                to shrink and shoves the collage past the viewport edge. */}
            <div className="min-w-0">
              <h1 className="type-display-hero max-w-[12ch] text-ink">
                {campusName
                  ? t("titleActive", { campusName })
                  : t("titleDefault")}
              </h1>

              <p className="type-body type-measure mt-6 text-ink-muted">
                {campusName
                  ? t("subtitleActive", { campusName })
                  : t("subtitleDefault")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="type-body-sm inline-flex items-center rounded-biso-pill bg-action px-5 py-2.5 font-medium text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href="/membership"
                >
                  {t("ctas.join")}
                </Link>
                <Link
                  className="type-body-sm inline-flex items-center rounded-biso-pill border border-edge px-5 py-2.5 text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href="/events"
                >
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

              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { value: eventCount, label: t("stats.events") },
                  { value: jobCount, label: t("stats.jobs") },
                  { value: campuses.length, label: t("stats.campuses") },
                ]
                  // Only real counts. No invented "1000+ members" tile.
                  .filter((stat) => stat.value > 0)
                  .map((stat) => (
                    <div key={stat.label}>
                      <dd className="type-data text-2xl text-ink leading-none">
                        {stat.value}
                      </dd>
                      <dt className="type-body-sm mt-1 text-ink-muted">
                        {stat.label}
                      </dt>
                    </div>
                  ))}
              </dl>
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
