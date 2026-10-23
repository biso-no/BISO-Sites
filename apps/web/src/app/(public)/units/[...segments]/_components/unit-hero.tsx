import { UNIT_CATEGORY_MESSAGE_KEYS } from "@repo/shared/utils/unit-categories";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Facebook, Globe, Instagram, Linkedin, Twitter } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { UnitCrest } from "@/components/units/unit-crest";
import { campusIdToSlug } from "@/lib/campus-scope";
import type { UnitDetail } from "@/lib/data/units";

/**
 * The unit's header: the site's navy band, with the unit's own identity in it.
 *
 * Its crest — the uploaded logo, or the name-derived monogram that is the one
 * genuinely per-unit thing most units have — sits beside the category, the
 * same tile the directory card shows, so arriving here confirms the click. A
 * real `hero` image, once a unit uploads one, fills the chevron frame; nothing
 * stands in for it until then.
 */
export async function UnitHero({ unit }: { unit: UnitDetail }) {
  const [t, tCategory, tCommon, tNav] = await Promise.all([
    getTranslations("units"),
    getTranslations("jobs"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);
  const campusSlug = campusIdToSlug(unit.campusId);
  const socials = unit.socials.filter(
    (social): social is { platform: string | null; url: string } =>
      Boolean(social.url)
  );

  return (
    <PageHeader
      actions={
        socials.length > 0 ? (
          <SocialLinks label={t("detail.follow")} socials={socials} />
        ) : undefined
      }
      breadcrumbs={[
        { label: tCommon("breadcrumbs.home"), href: "/" },
        { label: tNav("links.units"), href: "/units" },
        ...(unit.campusLabel && campusSlug
          ? [{ label: unit.campusLabel, href: `/units?campus=${campusSlug}` }]
          : []),
        { label: unit.name },
      ]}
      eyebrow={
        unit.campusLabel
          ? t("detail.campusBadge", { campus: unit.campusLabel })
          : undefined
      }
      lede={unit.summary ?? undefined}
      media={
        unit.heroUrl ? (
          <ImageWithFallback
            alt=""
            fill
            priority
            sizes="22rem"
            src={unit.heroUrl}
          />
        ) : undefined
      }
      meta={
        <>
          <UnitCrest className="size-16 text-xl" size={64} unit={unit} />
          {unit.category ? (
            <Pill tone="accent" uppercase>
              {tCategory(
                `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category]}`
              )}
            </Pill>
          ) : null}
        </>
      }
      title={unit.name}
    />
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

function SocialLinks({
  label,
  socials,
}: {
  label: string;
  socials: { platform: string | null; url: string }[];
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-2">
      {socials.map((social) => {
        const Icon = socialIcon(social.platform);
        return (
          <li key={social.url}>
            <a
              className="inline-flex size-10 items-center justify-center rounded-biso-pill border border-edge text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={social.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className="sr-only">{social.platform ?? social.url}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
