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
      <label>{label}</label>
      {children}
    </div>
  );
}
