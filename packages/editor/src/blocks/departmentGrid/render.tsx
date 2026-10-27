"use client";

import { Crest } from "@/blocks/_v2/crest";
import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import {
  departmentsFeedKey,
  unitsBlockLimit,
  unitsFeedCampus,
  unitsFeedCategory,
} from "@/editor/page-feeds";
import type { DepartmentGridBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface FeedUnit {
  campusLabel?: string;
  href?: string;
  id?: string;
  logoUrl?: string;
  name?: string;
}

/**
 * Module scope on purpose: `useAutoFeed` takes this as an effect dependency,
 * so a closure recreated per render would refetch forever. The snapshot holds
 * the rows; the HTTP endpoint answers `{ departments, total }`.
 */
const selectDepartments = (payload: unknown): FeedUnit[] => {
  const departments = (payload as { departments?: unknown } | null)
    ?.departments;
  return Array.isArray(departments) ? (departments as FeedUnit[]) : [];
};

const CARD =
  "group flex h-full flex-col rounded-biso-md border border-edge bg-surface-raised p-5 hover:border-ink-accent";

function UnitCard({ edit, unit }: { edit: boolean; unit: FeedUnit }) {
  const name = typeof unit.name === "string" ? unit.name : "";
  return (
    <FeedCardShell className={CARD} edit={edit} href={unit.href}>
      <span className="flex items-start gap-4">
        <Crest logoUrl={unit.logoUrl} name={name} />
        <span className="min-w-0 flex-1">
          <span className="type-heading-card block break-words text-ink group-hover:text-ink-accent">
            {name}
          </span>
          {unit.campusLabel ? (
            <span className="type-label mt-1 block text-ink-muted">
              {unit.campusLabel}
            </span>
          ) : null}
        </span>
      </span>
    </FeedCardShell>
  );
}

interface Props {
  block: DepartmentGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function DepartmentGridRender({ block, edit, onPatch }: Props) {
  const { campus: pageCampus, locale } = usePageFeedSource();
  const campus = unitsFeedCampus(block.scope, pageCampus);
  const category = unitsFeedCategory(block.category);
  const limit = unitsBlockLimit(block.limit);
  const params = new URLSearchParams();
  if (campus) {
    params.set("campus_id", campus);
  }
  if (category) {
    params.set("type", category);
  }
  const query = params.toString();
  const { items } = useAutoFeed<FeedUnit>({
    enabled: true,
    key: departmentsFeedKey(campus, category),
    select: selectDepartments,
    url: `/api/pages/departments${query ? `?${query}` : ""}`,
  });
  const units = items === null ? null : listOf<FeedUnit>(items).slice(0, limit);

  return (
    <FeedSection
      dept=""
      edit={edit}
      heading={block.heading ?? ""}
      items={units}
      locale={locale}
      noun="units"
      onPatch={onPatch}
      requireDept={false}
      seeAll={false}
      seeAllHref=""
    >
      {(units ?? []).map((unit, i) => (
        <UnitCard edit={edit} key={unit.id ?? i} unit={unit} />
      ))}
    </FeedSection>
  );
}
