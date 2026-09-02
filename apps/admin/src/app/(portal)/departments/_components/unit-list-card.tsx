import { resolveStorageFileUrl } from "@repo/api/storage";
import type { Departments } from "@repo/api/types/appwrite";
import { parseUnitCategory } from "@repo/shared/utils/unit-categories";
import { Building2, ImageOff, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SERIF_STACK, STUDIO, StudioIconBox } from "../../_components/studio";

export interface UnitListCardLabels {
  /** Human label for the unit's category, or null when it has none. */
  category: string | null;
  inactive: string;
  members: string;
  noCategory: string;
  noLogo: string;
}

function CardMedia({
  heroUrl,
  logoUrl,
}: {
  heroUrl: string | null;
  logoUrl: string | null;
}) {
  if (heroUrl) {
    return (
      <Image
        alt=""
        className="object-cover opacity-60"
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        src={heroUrl}
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <StudioIconBox color={STUDIO.claret}>
        {logoUrl ? (
          <Image
            alt=""
            className="object-contain"
            height={22}
            src={logoUrl}
            unoptimized
            width={22}
          />
        ) : (
          <Building2 size={18} />
        )}
      </StudioIconBox>
    </div>
  );
}

/**
 * One unit in the management listing.
 *
 * Both `hero` and `logo` may hold either a bare Appwrite file id — which is
 * what the profile editor stores in `logo`, because that column is
 * `string(100)` and a full storage URL does not reliably fit — or a URL, so
 * every read goes through `resolveStorageFileUrl`.
 */
export function UnitListCard({
  campusName,
  department,
  labels,
}: {
  campusName: string;
  department: Departments;
  labels: UnitListCardLabels;
}) {
  const category = parseUnitCategory(department.type);
  const heroUrl = resolveStorageFileUrl(department.hero);
  const logoUrl = resolveStorageFileUrl(department.logo);

  return (
    <Link
      className="group block overflow-hidden rounded-2xl border transition hover:bg-white/70"
      href={`/departments/${department.$id}`}
      style={{
        background: "rgba(255,255,255,0.46)",
        borderColor: STUDIO.rule,
      }}
    >
      <div
        className="relative h-24 overflow-hidden"
        style={{ background: STUDIO.paper2 }}
      >
        <CardMedia heroUrl={heroUrl} logoUrl={logoUrl} />
        <span
          className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[10px] uppercase"
          style={{
            background: category
              ? "rgba(250,247,242,0.9)"
              : "rgba(176,138,62,0.18)",
            color: category ? STUDIO.ink3 : STUDIO.gold,
          }}
        >
          {category ? null : <TriangleAlert size={10} />}
          {labels.category ?? labels.noCategory}
        </span>
        {department.active === false && (
          <span
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px]"
            style={{
              background: "rgba(107,30,30,0.10)",
              color: STUDIO.claret,
            }}
          >
            {labels.inactive}
          </span>
        )}
      </div>

      <div className="p-4">
        <p
          className="text-2xl leading-7"
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {department.Name}
        </p>
        <p className="mt-1 text-xs" style={{ color: STUDIO.ink3 }}>
          {campusName}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: STUDIO.ink4 }}>
            {labels.members}: {department.users?.length ?? 0}
          </span>
          {logoUrl ? null : (
            <span
              className="inline-flex items-center gap-1 text-[10px]"
              style={{ color: STUDIO.gold }}
            >
              <ImageOff size={11} />
              {labels.noLogo}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
