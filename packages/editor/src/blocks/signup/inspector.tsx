"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { SubmissionFields } from "@/components/editor-shell/inspector/submission-fields";
import type { PageDoc, SignupBlock } from "@/editor/types";

interface Props {
  block: SignupBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function SignupInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Placeholder">
          <input
            onChange={(e) => onPatch("placeholder", e.target.value)}
            placeholder="you@bi.no"
            value={block.placeholder ?? ""}
          />
        </InspRow>
      </InspSection>
      <SubmissionFields
        onPatch={onPatch}
        recipientEmail={block.recipientEmail}
        submitMode={block.submitMode}
        topic={block.topic}
      />
    </>
  );
}
