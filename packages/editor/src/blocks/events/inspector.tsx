"use client";

import type { PatchFn } from "@/blocks/types";
import { FeedFields } from "@/components/editor-shell/inspector/feed-fields";
import type { EventsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: EventsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function EventsInspector({ block, onPatch }: Props) {
  return <FeedFields block={block} label="Events feed" onPatch={onPatch} />;
}
