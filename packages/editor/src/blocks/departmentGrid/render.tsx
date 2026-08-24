"use client";

import type { PatchFn } from "@/blocks/types";
import { pageFeedKey } from "@/editor/page-feeds";
import type { DepartmentGridBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface DeptItem {
  campusId: string | null;
  id: string;
  internalId: string | null;
  logo: string | null;
  name: string;
  type: string | null;
}

interface Props {
  block: DepartmentGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

/**
 * Module scope on purpose: `useAutoFeed` takes this as an effect dependency,
 * so a closure recreated per render would refetch forever.
 */
const selectDepartments = (payload: unknown): DeptItem[] => {
  const departments = (payload as { departments?: unknown } | null)
    ?.departments;
  return Array.isArray(departments) ? (departments as DeptItem[]) : [];
};

export function DepartmentGridRender({ block }: Props) {
  const { items, loading } = useAutoFeed<DeptItem>({
    enabled: true,
    key: pageFeedKey("departments"),
    select: selectDepartments,
    url: "/api/pages/departments",
  });
  const departments = items ?? [];

  return (
    <div
      className={`pg-deptgrid pg-deptgrid--${block.variant ?? "grid"} pg-block`}
    >
      {block.heading && <h2 className="pg-deptgrid__h">{block.heading}</h2>}
      {loading && (
        <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
          Loading departments…
        </p>
      )}
      <div className="pg-deptgrid__grid">
        {departments.map((dept) => (
          <div className="pg-deptgrid__card" key={dept.id}>
            <div className="pg-deptgrid__card-name">{dept.name}</div>
            {dept.type && (
              <div className="pg-deptgrid__card-tag">
                {dept.type}
                {dept.campusId ? ` · ${dept.campusId.toUpperCase()}` : ""}
              </div>
            )}
          </div>
        ))}
        {!loading && departments.length === 0 && (
          <p
            style={{ fontSize: 13, color: "var(--ink-3)", gridColumn: "1/-1" }}
          >
            No departments found.
          </p>
        )}
      </div>
    </div>
  );
}
