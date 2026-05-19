"use client";

import type { ContactBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: ContactBlock; doc: PageDoc; onPatch: PatchFn; }

export function ContactInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Contact">
      <InspRow label="Heading">
        <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
      </InspRow>
      <InspRow label="Email">
        <input type="email" value={block.email} onChange={(e) => onPatch("email", e.target.value)} />
      </InspRow>
      <InspRow label="Instagram">
        <input value={block.instagram} onChange={(e) => onPatch("instagram", e.target.value)} />
      </InspRow>
      <InspRow label="Address">
        <input value={block.address} onChange={(e) => onPatch("address", e.target.value)} />
      </InspRow>
      <InspRow label="Hours">
        <input value={block.hours} onChange={(e) => onPatch("hours", e.target.value)} />
      </InspRow>
    </InspSection>
  );
}
