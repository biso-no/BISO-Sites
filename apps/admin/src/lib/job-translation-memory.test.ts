import { describe, expect, test } from "bun:test";
import {
  descriptionBlocksToHtml,
  newBlock,
  newMediaBlock,
} from "@/app/(portal)/_components/description-blocks";
import {
  applyDescriptionMerge,
  computeJobTranslationMemory,
  parseJobTranslationMemory,
  planDescriptionMerge,
  serializeJobTranslationMemory,
} from "./job-translation-memory";

const html = (blocks: Parameters<typeof descriptionBlocksToHtml>[0]) =>
  descriptionBlocksToHtml(blocks);
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

describe("computeJobTranslationMemory", () => {
  test("hashes title, short description, and each description block", () => {
    const memory = computeJobTranslationMemory({
      description: html([newBlock("p", "Alpha"), newBlock("p", "Beta")]),
      short_description: "Teaser",
      title: "Title",
    });

    expect(memory.titleHash).toBeString();
    expect(memory.shortDescriptionHash).toBeString();
    expect(memory.descriptionBlockHashes).toHaveLength(2);
  });

  test("keeps unrelated hashes stable when only one field changes", () => {
    const base = {
      description: html([newBlock("p", "Alpha"), newBlock("p", "Beta")]),
      short_description: "Teaser",
      title: "Title",
    };
    const editedTitle = computeJobTranslationMemory({
      ...base,
      title: "New title",
    });
    const original = computeJobTranslationMemory(base);

    expect(editedTitle.titleHash).not.toBe(original.titleHash);
    expect(editedTitle.shortDescriptionHash).toBe(
      original.shortDescriptionHash
    );
    expect(editedTitle.descriptionBlockHashes).toEqual(
      original.descriptionBlockHashes
    );
  });

  test("changes only the hash of the edited description block", () => {
    const before = computeJobTranslationMemory({
      description: html([
        newBlock("p", "Alpha"),
        newBlock("p", "Beta"),
        newBlock("p", "Gamma"),
      ]),
      short_description: "",
      title: "",
    });
    const after = computeJobTranslationMemory({
      description: html([
        newBlock("p", "Alpha"),
        newBlock("p", "Beta, edited"),
        newBlock("p", "Gamma"),
      ]),
      short_description: "",
      title: "",
    });

    expect(after.descriptionBlockHashes[0]).toBe(
      before.descriptionBlockHashes[0]
    );
    expect(after.descriptionBlockHashes[1]).not.toBe(
      before.descriptionBlockHashes[1]
    );
    expect(after.descriptionBlockHashes[2]).toBe(
      before.descriptionBlockHashes[2]
    );
  });
});

describe("planDescriptionMerge", () => {
  test("marks every block for translation when there is no cache", () => {
    const source = html([newBlock("p", "Alpha"), newBlock("p", "Beta")]);
    const plan = planDescriptionMerge(source, "", null);

    expect(
      plan.segments.every((segment) => segment.needsTranslation)
    ).toBeTrue();
  });

  test("reuses every block when nothing changed since the cached translation", () => {
    const sourceBlocks = [newBlock("p", "Alpha"), newBlock("p", "Beta")];
    const targetBlocks = [
      newBlock("h", "Alpha (en)"),
      newBlock("p", "Beta (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(sourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const plan = planDescriptionMerge(
      html(sourceBlocks),
      html(targetBlocks),
      cache
    );

    expect(plan.segments).toHaveLength(2);
    for (const segment of plan.segments) {
      expect(segment.needsTranslation).toBeFalse();
    }
    expect(plan.segments[0]).toMatchObject({ text: "Alpha (en)" });
    expect(plan.segments[1]).toMatchObject({ text: "Beta (en)" });
  });

  test("only flags the edited paragraph for translation, reusing the rest", () => {
    const oldSourceBlocks = [
      newBlock("p", "Alpha"),
      newBlock("p", "Beta"),
      newBlock("p", "Gamma"),
    ];
    const targetBlocks = [
      newBlock("p", "Alpha (en)"),
      newBlock("p", "Beta (en)"),
      newBlock("p", "Gamma (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const newSourceBlocks = [
      newBlock("p", "Alpha"),
      newBlock("p", "Beta, revised"),
      newBlock("p", "Gamma"),
    ];
    const plan = planDescriptionMerge(
      html(newSourceBlocks),
      html(targetBlocks),
      cache
    );

    expect(plan.segments[0]).toMatchObject({
      needsTranslation: false,
      text: "Alpha (en)",
    });
    expect(plan.segments[1]).toMatchObject({ needsTranslation: true });
    expect(plan.segments[2]).toMatchObject({
      needsTranslation: false,
      text: "Gamma (en)",
    });
  });

  test("only flags a newly appended paragraph for translation", () => {
    const oldSourceBlocks = [newBlock("p", "Alpha"), newBlock("p", "Beta")];
    const targetBlocks = [
      newBlock("p", "Alpha (en)"),
      newBlock("p", "Beta (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const newSourceBlocks = [
      newBlock("p", "Alpha"),
      newBlock("p", "Beta"),
      newBlock("p", "Gamma"),
    ];
    const plan = planDescriptionMerge(
      html(newSourceBlocks),
      html(targetBlocks),
      cache
    );

    expect(plan.segments.map((s) => s.needsTranslation)).toEqual([
      false,
      false,
      true,
    ]);
  });

  test("matches reordered paragraphs by content instead of position", () => {
    const oldSourceBlocks = [newBlock("p", "Alpha"), newBlock("p", "Beta")];
    const targetBlocks = [
      newBlock("p", "Alpha (en)"),
      newBlock("p", "Beta (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const reorderedSourceBlocks = [
      newBlock("p", "Beta"),
      newBlock("p", "Alpha"),
    ];
    const plan = planDescriptionMerge(
      html(reorderedSourceBlocks),
      html(targetBlocks),
      cache
    );

    expect(plan.segments.map((s) => s.needsTranslation)).toEqual([
      false,
      false,
    ]);
    expect(plan.segments[0]).toMatchObject({ text: "Beta (en)" });
    expect(plan.segments[1]).toMatchObject({ text: "Alpha (en)" });
  });

  test("matches duplicate paragraphs one-to-one rather than reusing a single slot twice", () => {
    const oldSourceBlocks = [newBlock("p", "Same"), newBlock("p", "Same")];
    const targetBlocks = [
      newBlock("p", "Same (en) #1"),
      newBlock("p", "Same (en) #2"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const plan = planDescriptionMerge(
      html(oldSourceBlocks),
      html(targetBlocks),
      cache
    );

    expect(plan.segments.map((s) => s.needsTranslation)).toEqual([
      false,
      false,
    ]);
    expect(plan.segments[0]).toMatchObject({ text: "Same (en) #1" });
    expect(plan.segments[1]).toMatchObject({ text: "Same (en) #2" });
  });

  test("falls back to translating everything when the target was hand-edited out of alignment", () => {
    const oldSourceBlocks = [newBlock("p", "Alpha"), newBlock("p", "Beta")];
    // A human inserted an extra paragraph directly into the translated locale,
    // so the cached hash list no longer lines up positionally with the target.
    const handEditedTargetBlocks = [
      newBlock("p", "Alpha (en)"),
      newBlock("p", "Inserted by hand"),
      newBlock("p", "Beta (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const plan = planDescriptionMerge(
      html(oldSourceBlocks),
      html(handEditedTargetBlocks),
      cache
    );

    expect(
      plan.segments.every((segment) => segment.needsTranslation)
    ).toBeTrue();
  });

  test("assigns unique field keys to every segment needing translation", () => {
    const source = html([
      newBlock("p", "Alpha"),
      newBlock("p", "Beta"),
      newBlock("p", "Gamma"),
    ]);
    const plan = planDescriptionMerge(source, "", null);
    const keys = plan.segments
      .filter((segment) => segment.needsTranslation)
      .map((segment) => (segment.needsTranslation ? segment.fieldKey : ""));

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(FIELD_KEY_PATTERN);
    }
  });
});

describe("applyDescriptionMerge", () => {
  test("reassembles reused and freshly translated blocks in source order", () => {
    const oldSourceBlocks = [
      newBlock("p", "Alpha"),
      newBlock("p", "Beta"),
      newBlock("p", "Gamma"),
    ];
    const targetBlocks = [
      newBlock("p", "Alpha (en)"),
      newBlock("p", "Beta (en)"),
      newBlock("p", "Gamma (en)"),
    ];
    const cache = computeJobTranslationMemory({
      description: html(oldSourceBlocks),
      short_description: "",
      title: "",
    }).descriptionBlockHashes;

    const newSourceBlocks = [
      newBlock("p", "Alpha"),
      newBlock("p", "Beta, revised"),
      newBlock("p", "Gamma"),
    ];
    const plan = planDescriptionMerge(
      html(newSourceBlocks),
      html(targetBlocks),
      cache
    );
    const translatedFields: Record<string, string> = {};
    for (const segment of plan.segments) {
      if (segment.needsTranslation) {
        translatedFields[segment.fieldKey] = "Beta, revised (en)";
      }
    }

    const merged = applyDescriptionMerge(plan, translatedFields);

    expect(merged).toBe(
      html([
        newBlock("p", "Alpha (en)"),
        newBlock("p", "Beta, revised (en)"),
        newBlock("p", "Gamma (en)"),
      ])
    );
  });

  test("keeps media metadata and swaps only the caption", () => {
    const sourceMedia = newMediaBlock({
      alt: "Team photo",
      caption: "Original caption",
      fileId: "file-1",
      fileName: "team.jpg",
      mediaKind: "image",
      mimeType: "image/jpeg",
      url: "https://example.com/team.jpg",
    });
    const plan = planDescriptionMerge(html([sourceMedia]), "", null);
    const fieldKey =
      plan.segments[0].needsTranslation && plan.segments[0].fieldKey;
    if (!fieldKey) {
      throw new Error("expected the media caption to need translation");
    }

    const merged = applyDescriptionMerge(plan, {
      [fieldKey]: "Translated caption",
    });

    expect(merged).toContain('data-url="https://example.com/team.jpg"');
    expect(merged).toContain('data-file-id="file-1"');
    expect(merged).toContain("<figcaption>Translated caption</figcaption>");
    expect(merged).not.toContain("Original caption");
  });
});

describe("job translation memory persistence", () => {
  test("round-trips through JSON", () => {
    const memory = computeJobTranslationMemory({
      description: html([newBlock("p", "Alpha")]),
      short_description: "Teaser",
      title: "Title",
    });

    const serialized = serializeJobTranslationMemory(memory);
    expect(serialized).toBeString();
    expect(parseJobTranslationMemory(serialized)).toEqual(memory);
  });

  test("returns null for missing, malformed, or garbage input", () => {
    expect(parseJobTranslationMemory(null)).toBeNull();
    expect(parseJobTranslationMemory(undefined)).toBeNull();
    expect(parseJobTranslationMemory("not json")).toBeNull();
    expect(parseJobTranslationMemory('{"foo":"bar"}')).toBeNull();
  });

  test("declines to serialize a cache too large for the additional_fields column", () => {
    const memory = computeJobTranslationMemory({
      description: html(
        Array.from({ length: 400 }, (_, i) => newBlock("p", `Paragraph ${i}`))
      ),
      short_description: "",
      title: "",
    });

    expect(serializeJobTranslationMemory(memory)).toBeNull();
  });
});
