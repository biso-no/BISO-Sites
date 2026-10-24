"use client";

import type { PatchFn } from "@/blocks/types";
import { FeedFields } from "@/components/editor-shell/inspector/feed-fields";
import type { NewsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: NewsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function NewsInspector({ block, onPatch }: Props) {
  return <FeedFields block={block} label="News feed" onPatch={onPatch} />;
}
