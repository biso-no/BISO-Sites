"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { ContactBlock, PageDoc } from "@/editor/types";

interface Props {
  block: ContactBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ContactInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Contact">
      <InspRow label="Heading">
        <input
          onChange={(e) => onPatch("heading", e.target.value)}
          value={block.heading ?? ""}
        />
      </InspRow>
      <InspRow label="Email">
        <input
          onChange={(e) => onPatch("email", e.target.value)}
          type="email"
          value={block.email ?? ""}
        />
      </InspRow>
      <InspRow label="Phone">
        <input
          onChange={(e) => onPatch("phone", e.target.value)}
          type="tel"
          value={block.phone ?? ""}
        />
      </InspRow>
      <InspRow label="Instagram">
        <input
          onChange={(e) => onPatch("instagram", e.target.value)}
          placeholder="@handle"
          value={block.instagram ?? ""}
        />
      </InspRow>
      <InspRow label="Address">
        <input
          onChange={(e) => onPatch("address", e.target.value)}
          value={block.address ?? ""}
        />
      </InspRow>
      <InspRow label="Hours">
        <input
          onChange={(e) => onPatch("hours", e.target.value)}
          value={block.hours ?? ""}
        />
      </InspRow>
      <p className="pe-insp-note">
        Empty fields are left out on the site. With every field empty the block
        shows nothing.
      </p>
    </InspSection>
  );
}
