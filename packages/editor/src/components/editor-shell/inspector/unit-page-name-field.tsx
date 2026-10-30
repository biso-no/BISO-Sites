"use client";

import { useEffect, useRef } from "react";
import { slugifyAnchor } from "@/editor/operations";
import { unitPageName } from "@/editor/page-scope";
import type { EditorDepartment, PageMeta } from "@/editor/types";

/**
 * The address of a page held below its department's unit:
 * `units/<campus>/<unit>/` is fixed and only the page's own name is typed.
 * Commits on blur or Enter, like the section link name, so a half-typed name
 * (a trailing dash) is never autosaved.
 */
export function UnitPageNameField({
  departments,
  meta,
  onSlug,
}: {
  departments: EditorDepartment[];
  meta: PageMeta;
  onSlug: (slug: string) => void;
}) {
  const unitSlug = departments.find((d) => d.id === meta.department)?.unitSlug;
  const name = unitSlug ? unitPageName(meta.slug, unitSlug) : "";
  const field = useRef<HTMLInputElement>(null);
  // A department change, an undo or a redo shows the stored name.
  useEffect(() => {
    if (field.current && field.current.value !== name) {
      field.current.value = name;
    }
  }, [name]);

  if (!unitSlug) {
    return (
      <input
        disabled
        id="pe-page-slug"
        placeholder={
          meta.department
            ? "This department has no page on biso.no"
            : "Choose the department first"
        }
        readOnly
        value=""
      />
    );
  }

  const commit = (input: HTMLInputElement) => {
    const next = slugifyAnchor(input.value);
    input.value = next || name;
    if (next && next !== name) {
      onSlug(`${unitSlug}/${next}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          color: "var(--ink-3)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          wordBreak: "break-all",
        }}
      >
        {unitSlug}/
      </span>
      <input
        aria-label="Page name"
        defaultValue={name}
        id="pe-page-slug"
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(e.currentTarget);
          }
        }}
        ref={field}
      />
    </div>
  );
}
