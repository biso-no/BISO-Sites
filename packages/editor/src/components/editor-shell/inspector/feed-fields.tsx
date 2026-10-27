"use client";

import type { PatchFn } from "@/blocks/types";
import { feedBlockLimit } from "@/editor/page-feeds";
import type { EventsBlock, JobsBlock, NewsBlock } from "@/editor/types";
import { InspRow, InspSection, Segmented } from "./insp-parts";
import { SourcePicker } from "./source-picker";

const LIMITS = [
  { label: "3", value: "3" },
  { label: "6", value: "6" },
] as const;

/** Inspector body shared by the live events, news and jobs blocks. */
export function FeedFields({
  block,
  label,
  onPatch,
}: {
  block: EventsBlock | JobsBlock | NewsBlock;
  label: string;
  onPatch: PatchFn;
}) {
  return (
    <>
      <InspSection label={label}>
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Show">
          <Segmented
            choices={[...LIMITS]}
            onPick={(v) => onPatch("limit", v === "6" ? 6 : 3)}
            value={String(feedBlockLimit(block.limit)) as "3" | "6"}
          />
        </InspRow>
        <InspRow label="See all link">
          <input
            checked={block.seeAll !== false}
            onChange={(e) => onPatch("seeAll", e.target.checked)}
            type="checkbox"
          />
        </InspRow>
      </InspSection>
      <InspSection label="Data source">
        <InspRow label="Department">
          <SourcePicker
            onChange={(v) => onPatch("source", v)}
            value={block.source ?? "auto"}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
