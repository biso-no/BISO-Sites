"use client";

import type { PatchFn } from "@/blocks/types";
import { FeedFields } from "@/components/editor-shell/inspector/feed-fields";
import type { JobsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: JobsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function JobsInspector({ block, onPatch }: Props) {
  return <FeedFields block={block} label="Open roles" onPatch={onPatch} />;
}
