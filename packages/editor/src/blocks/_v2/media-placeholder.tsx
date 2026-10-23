import type { CSSProperties } from "react";
import type { FrameRatio } from "@/editor/types";
import { ratioValue } from "./media";

/** Shown in the editor and on the site, so the site never has a broken image. */
export function MediaPlaceholder({
  label,
  ratio,
}: {
  label: string;
  ratio: FrameRatio;
}) {
  return (
    <div
      className="type-body-sm flex w-full items-center justify-center bg-surface-sunken p-4 text-center text-ink-muted"
      style={{ aspectRatio: `1 / ${ratioValue(ratio)}` } as CSSProperties}
    >
      {label}
    </div>
  );
}
