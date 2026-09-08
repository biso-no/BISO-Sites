import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  ArrowLeft,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  Twitter,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import type { UnitDetail } from "@/lib/data/units";
import { unitMonogram } from "@/lib/unit-monogram";

/**
 * The unit's own crest colour carries the hero.
 *
 * No unit has uploaded a logo or a hero image, so a shared stock photograph
 * behind all 125 of them made every unit page look like the same page. The
 * derived hue is the one thing that is genuinely per-unit, and it is the same
 * colour the directory card uses — so arriving here confirms you clicked the
 * right card. A real `hero` image, once a unit uploads one, still wins.
 */
export async function UnitHero({ unit }: { unit: UnitDetail }) {
  const t = await getTranslations("units");
  const tCategory = await getTranslations("jobs");
  const crest = unitMonogram(unit.name, unit.graphName);

  return (
    <header className="relative isolate overflow-hidden">
      {unit.heroUrl ? (
        <>
          <ImageWithFallback
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            fill
            priority
            sizes="100vw"
            src={unit.heroUrl}
          />
          <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: crest.background }}
        />
      )}
      {/* Keeps text legible over both treatments. */}
      <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/10 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:px-8">
        <Link
          className="inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
          href="/units"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </Link>

        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end">
          <span
            aria-hidden="true"
            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/25 bg-white/15 font-bold text-3xl text-white shadow-lg backdrop-blur-sm"
          >
            {unit.logoUrl ? (
              <ImageWithFallback
                alt=""
                className="h-full w-full object-contain p-2"
                height={96}
                src={unit.logoUrl}
                width={96}
              />
            ) : (
              crest.initials
            )}
          </span>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {unit.campusLabel && (
                <Badge className="border-white/30 bg-white/15 text-white">
                  <MapPin className="mr-1 h-3 w-3" />
                  {t("detail.campusBadge", { campus: unit.campusLabel })}
                </Badge>
              )}
              {unit.category && (
                <Badge className="border-white/30 bg-white/15 text-white">
                  {tCategory(
                    `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category as UnitCategory]}`
                  )}
                </Badge>
              )}
            </div>
            <h1 className="font-bold text-3xl text-white sm:text-4xl md:text-5xl">
              {unit.name}
            </h1>
            {unit.summary && (
              <p className="mt-4 max-w-2xl text-lg text-white/90">
                {unit.summary}
              </p>
            )}
            <SocialLinks socials={unit.socials} />
          </div>
        </div>
      </div>
    </header>
  );
}

const SOCIAL_ICONS: [string, ComponentType<{ className?: string }>][] = [
  ["instagram", Instagram],
  ["facebook", Facebook],
  ["linkedin", Linkedin],
  ["twitter", Twitter],
  ["x", Twitter],
];

function socialIcon(platform: string | null) {
  const key = (platform ?? "").toLowerCase();
  return SOCIAL_ICONS.find(([name]) => key.includes(name))?.[1] ?? Globe;
}

function SocialLinks({ socials }: { socials: UnitDetail["socials"] }) {
  const links = socials.filter((social) => social.url);
  if (links.length === 0) {
    return null;
  }
  return (
    <ul className="mt-6 flex flex-wrap items-center gap-3">
      {links.map((social) => {
        const Icon = socialIcon(social.platform);
        return (
          <li key={social.url}>
            <a
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm transition-transform hover:scale-110"
              href={social.url as string}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className="h-4 w-4 text-white" />
              <span className="sr-only">{social.platform ?? "Link"}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
