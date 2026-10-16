"use client";

import { useMemo } from "react";
import { qrPath } from "./qr-path";

const QUIET_ZONE = 2;

export function QrCode({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  const { path, size } = useMemo(() => qrPath(value), [value]);
  const box = size + QUIET_ZONE * 2;
  return (
    <svg
      aria-label={label}
      className={className}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
    >
      <title>{label}</title>
      <rect
        fill="#fff"
        height={box}
        width={box}
        x={-QUIET_ZONE}
        y={-QUIET_ZONE}
      />
      <path d={path} fill="#000" />
    </svg>
  );
}
