"use client";

import { useEditorCallbacks } from "@/editor/callbacks";
import { useEditorStore } from "@/editor/store";
import type { EditorDepartment } from "@/editor/types";

const AUTO = "auto";

function options(departments: EditorDepartment[]) {
  return departments.map((d) => (
    <option key={d.id} value={d.id}>
      {d.name}
    </option>
  ));
}

/**
 * Which department a live block reads from: the page's own (`auto`) or any
 * department the editor may pick, grouped by campus with the page's campus
 * first. Replaces the free-text department id.
 */
export function SourcePicker({
  onChange,
  pageCampus: campusOverride,
  value,
}: {
  onChange: (value: string) => void;
  /** The page's campus; defaults to the one on the edited document. */
  pageCampus?: string;
  value: string;
}) {
  const { campuses, departments } = useEditorCallbacks();
  const storeCampus = useEditorStore((s) => s.doc.meta.campus);
  const pageCampus = campusOverride ?? storeCampus;
  const current = value || AUTO;
  const known = current === AUTO || departments.some((d) => d.id === current);

  const ordered = [...campuses].sort(
    (a, b) => Number(b.id === pageCampus) - Number(a.id === pageCampus)
  );
  const campusIds = new Set(campuses.map((c) => c.id));
  const loose = departments.filter(
    (d) => !(d.campusId && campusIds.has(d.campusId))
  );

  return (
    <select onChange={(e) => onChange(e.target.value)} value={current}>
      <option value={AUTO}>This page's department</option>
      {known ? null : <option value={current}>{current}</option>}
      {ordered.map((campus) => {
        const inCampus = departments.filter((d) => d.campusId === campus.id);
        return inCampus.length > 0 ? (
          <optgroup key={campus.id} label={campus.name}>
            {options(inCampus)}
          </optgroup>
        ) : null;
      })}
      {loose.length > 0 ? (
        <optgroup label="Other">{options(loose)}</optgroup>
      ) : null}
    </select>
  );
}
