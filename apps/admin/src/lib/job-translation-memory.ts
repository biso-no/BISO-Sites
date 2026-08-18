import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type DescriptionBlock,
  descriptionBlocksToHtml,
  htmlToDescriptionBlocks,
  isTextDescriptionBlock,
} from "@/app/(portal)/_components/description-blocks";

/**
 * Lets a job's auto-translation pass reuse the previous machine translation
 * for any title/short description/description paragraph whose source text
 * hasn't changed since it was last translated, instead of resending the
 * whole vacancy to the model on every save. Persisted as JSON in the target
 * locale's `content_translations.additional_fields` column.
 */
export interface JobTranslationSnapshot {
  description: string;
  short_description: string;
  title: string;
}

export interface JobTranslationMemory {
  descriptionBlockHashes: string[];
  shortDescriptionHash: string;
  titleHash: string;
}

export type DescriptionMergeSegment =
  | {
      block: DescriptionBlock;
      fieldKey: string;
      needsTranslation: true;
      sourceText: string;
    }
  | { block: DescriptionBlock; needsTranslation: false; text: string };

export interface DescriptionMergePlan {
  segments: DescriptionMergeSegment[];
}

// Leaves headroom under the `additional_fields` column's 4000-char cap; a
// cache that would exceed it is dropped rather than truncated, degrading to
// a full retranslation next time instead of persisting a corrupt cache.
const MAX_ADDITIONAL_FIELDS_LENGTH = 4000;
const CACHE_SAFETY_MARGIN = 200;

const jobTranslationMemorySchema = z.object({
  descriptionBlockHashes: z.array(z.string()),
  shortDescriptionHash: z.string(),
  titleHash: z.string(),
});

const hashText = (value: string): string =>
  createHash("sha1").update(value).digest("hex").slice(0, 16);

const segmentText = (block: DescriptionBlock): string =>
  isTextDescriptionBlock(block) ? block.text : block.caption;

const segmentIdentity = (block: DescriptionBlock): string =>
  isTextDescriptionBlock(block)
    ? block.type
    : `media:${block.mediaKind}:${block.fileId}:${block.url}`;

const segmentHash = (block: DescriptionBlock): string =>
  hashText(`${segmentIdentity(block)}::${segmentText(block)}`);

const applyTranslatedText = (
  block: DescriptionBlock,
  text: string
): DescriptionBlock =>
  isTextDescriptionBlock(block)
    ? { ...block, text }
    : { ...block, caption: text };

export function computeJobTranslationMemory(
  source: JobTranslationSnapshot
): JobTranslationMemory {
  return {
    descriptionBlockHashes: htmlToDescriptionBlocks(source.description).map(
      segmentHash
    ),
    shortDescriptionHash: hashText(source.short_description),
    titleHash: hashText(source.title),
  };
}

export function parseJobTranslationMemory(
  raw: string | null | undefined
): JobTranslationMemory | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = jobTranslationMemorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeJobTranslationMemory(
  memory: JobTranslationMemory
): string | null {
  const json = JSON.stringify(memory);
  return json.length <= MAX_ADDITIONAL_FIELDS_LENGTH - CACHE_SAFETY_MARGIN
    ? json
    : null;
}

/**
 * Plans a description merge by matching each new-source block's content hash
 * against the cached hashes that produced the current target translation.
 * Matching is by content, not position, so reordering a paragraph doesn't
 * trigger a spurious retranslation and duplicate paragraphs are matched
 * one-to-one. If the target's block count no longer matches the cache (e.g.
 * a human hand-edited the translated locale directly, adding or removing a
 * paragraph), positional reuse can no longer be trusted, so every block
 * falls back to translation rather than risking a misaligned merge.
 */
export function planDescriptionMerge(
  newDescriptionHtml: string,
  targetDescriptionHtml: string,
  cachedDescriptionBlockHashes: string[] | null
): DescriptionMergePlan {
  const newBlocks = htmlToDescriptionBlocks(newDescriptionHtml);
  const targetBlocks = targetDescriptionHtml
    ? htmlToDescriptionBlocks(targetDescriptionHtml)
    : [];
  const canReuse =
    cachedDescriptionBlockHashes !== null &&
    cachedDescriptionBlockHashes.length === targetBlocks.length;

  const availableIndicesByHash = new Map<string, number[]>();
  if (canReuse) {
    cachedDescriptionBlockHashes.forEach((hash, index) => {
      const queue = availableIndicesByHash.get(hash);
      if (queue) {
        queue.push(index);
      } else {
        availableIndicesByHash.set(hash, [index]);
      }
    });
  }

  let translationCounter = 0;
  const segments: DescriptionMergeSegment[] = newBlocks.map((block) => {
    const queue = canReuse
      ? availableIndicesByHash.get(segmentHash(block))
      : undefined;
    const index = queue?.shift();
    if (index !== undefined) {
      const targetBlock = targetBlocks[index];
      return {
        block,
        needsTranslation: false,
        text: targetBlock ? segmentText(targetBlock) : segmentText(block),
      };
    }
    const fieldKey = `desc_${translationCounter}`;
    translationCounter += 1;
    return {
      block,
      fieldKey,
      needsTranslation: true,
      sourceText: segmentText(block),
    };
  });

  return { segments };
}

export function applyDescriptionMerge(
  plan: DescriptionMergePlan,
  translatedFields: Record<string, string>
): string {
  const blocks = plan.segments.map((segment) =>
    segment.needsTranslation
      ? applyTranslatedText(
          segment.block,
          translatedFields[segment.fieldKey] ?? ""
        )
      : applyTranslatedText(segment.block, segment.text)
  );
  return descriptionBlocksToHtml(blocks);
}
