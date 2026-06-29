"use client";

import { PanelColumn } from "../mega-panel";
import { ABOUT_COLUMNS } from "../nav-config";

interface AboutPanelProps {
  onNavigate: () => void;
}

export function AboutPanel({ onNavigate }: AboutPanelProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {ABOUT_COLUMNS.map((column) => (
        <PanelColumn column={column} key={column.id} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
