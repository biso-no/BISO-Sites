"use client";

import { useEditorCallbacks } from "@/editor/callbacks";

const AUTO = "auto";

/**
 * Which department a live block reads from: the page's own (`auto`) or any
 * department the editor may pick. Replaces the free-text department id.
 */
export function SourcePicker({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const { campuses, departments } = useEditorCallbacks();
  const current = value || AUTO;
  const known = current === AUTO || departments.some((d) => d.id === current);
  const campusName = (campusId: string | null) =>
    campuses.find((c) => c.id === campusId)?.name;
  return (
    <select onChange={(e) => onChange(e.target.value)} value={current}>
      <option value={AUTO}>This page's department</option>
      {known ? null : <option value={current}>{current}</option>}
      {departments.map((d) => {
        const campus = campusName(d.campusId);
        return (
          <option key={d.id} value={d.id}>
            {campus ? `${d.name} (${campus})` : d.name}
          </option>
        );
      })}
    </select>
  );
}
