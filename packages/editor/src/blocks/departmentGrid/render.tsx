"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import type { DepartmentGridBlock } from "@/editor/types";

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

export function DepartmentGridRender({ block }: Props) {
  const [items, setItems] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/pages/departments")
      .then((r) => r.json())
      .then((data: { departments: DeptItem[] }) => {
        if (!cancelled) {
          setItems(data.departments ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        {items.map((dept) => (
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
        {!loading && items.length === 0 && (
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
