"use client";

import { Switch } from "@repo/ui/components/ui/switch";
import type { ReactNode } from "react";
import { STUDIO } from "../../_components/studio";

/** A labelled on/off switch with a line of help, in a bordered row. */
export function SwitchRow({
  checked,
  color = STUDIO.ink,
  help,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  /** The label's colour, e.g. red for Important. */
  color?: string;
  help: ReactNode;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
      style={{ borderColor: STUDIO.rule }}
    >
      <div>
        <label className="font-medium text-sm" htmlFor={id} style={{ color }}>
          {label}
        </label>
        <p
          className="mt-0.5 text-[12.5px] leading-5"
          id={`${id}-help`}
          style={{ color: STUDIO.ink3 }}
        >
          {help}
        </p>
      </div>
      <Switch
        aria-describedby={`${id}-help`}
        checked={checked}
        className="mt-0.5 shrink-0"
        id={id}
        onCheckedChange={onChange}
      />
    </div>
  );
}
