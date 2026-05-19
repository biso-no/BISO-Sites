"use client";

import type { SignupBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: SignupBlock; onPatch: PatchFn; }

export function SignupInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Signup form">
      <InspRow label="Heading">
        <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
      </InspRow>
      <InspRow label="Placeholder">
        <input value={block.placeholder} onChange={(e) => onPatch("placeholder", e.target.value)} placeholder="you@bi.no" />
      </InspRow>
    </InspSection>
  );
}
