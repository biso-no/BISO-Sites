"use client";

import type {
  BlockBackground,
  BlockLayout,
  BlockSpacing,
  BlockWidth,
} from "@/blocks/_primitives/layout-types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "./insp-parts";

const BACKGROUNDS: { label: string; value: BlockBackground }[] = [
  { label: "Auto", value: "auto" },
  { label: "Plain", value: "default" },
  { label: "Tinted", value: "muted" },
  { label: "Brand", value: "brand" },
  { label: "Dark", value: "inverted" },
  { label: "Highlight", value: "accent" },
];

const SPACINGS: { label: string; value: BlockSpacing }[] = [
  { label: "None", value: "none" },
  { label: "Tight", value: "compact" },
  { label: "Normal", value: "normal" },
  { label: "Airy", value: "spacious" },
];

const WIDTHS: { label: string; value: BlockWidth }[] = [
  { label: "Narrow", value: "prose" },
  { label: "Medium", value: "content" },
  { label: "Wide", value: "wide" },
  { label: "Full bleed", value: "full" },
];

interface DesignPanelProps {
  layout?: BlockLayout;
  onPatch: PatchFn;
}

export const DesignPanel = ({ layout, onPatch }: DesignPanelProps) => (
  <InspSection label="Design">
    <InspRow label="Background">
      <select
        onChange={(event) => onPatch("layout.background", event.target.value)}
        value={layout?.background ?? "auto"}
      >
        {BACKGROUNDS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </InspRow>
    <InspRow label="Spacing">
      <select
        onChange={(event) => onPatch("layout.spacing", event.target.value)}
        value={layout?.spacing ?? "normal"}
      >
        {SPACINGS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </InspRow>
    <InspRow label="Width">
      <select
        onChange={(event) => onPatch("layout.width", event.target.value)}
        value={layout?.width ?? "wide"}
      >
        {WIDTHS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </InspRow>
  </InspSection>
);
