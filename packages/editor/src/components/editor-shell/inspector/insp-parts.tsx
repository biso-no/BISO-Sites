"use client";

import type { ReactNode } from "react";

export function InspSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="pe-insp-section">
      <div className="pe-insp-section__h">{label}</div>
      {children}
    </div>
  );
}

export function InspRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="pe-row">
      <div className="pe-row__label">{label}</div>
      {children}
    </div>
  );
}

export interface Choice<T extends string> {
  label: string;
  value: T;
}

/** One-of-a-few choice, as a row of buttons with the current one on. */
export function Segmented<T extends string>({
  choices,
  onPick,
  value,
}: {
  choices: Choice<T>[];
  onPick: (value: T) => void;
  value: T;
}) {
  return (
    <div className="pe-seg">
      {choices.map((choice) => (
        <button
          className={choice.value === value ? "on" : ""}
          key={choice.value}
          onClick={() => onPick(choice.value)}
          type="button"
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
