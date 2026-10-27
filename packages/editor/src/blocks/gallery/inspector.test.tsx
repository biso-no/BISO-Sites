import { expect, test } from "bun:test";
import type { GalleryImage } from "@/editor/types";
import { pickersIn } from "@/lib/test-tree";
import { GalleryImageFields } from "./inspector";

test("an uploaded gallery image stores its mime type; a linked one has none", () => {
  const updates: GalleryImage[] = [];
  const item: GalleryImage = { alt: "Campus", src: "https://old/a.jpg" };
  const [picker] = pickersIn(
    GalleryImageFields({ item, update: (next) => updates.push(next) })
  );
  picker?.props.onPicked("f-1", "https://x/f-1/view", "image/gif");
  picker?.props.onUrl("https://cdn/b.svg");
  expect(updates).toEqual([
    {
      alt: "Campus",
      fileId: "f-1",
      mime: "image/gif",
      src: "https://x/f-1/view",
    },
    { alt: "Campus", src: "https://cdn/b.svg" },
  ]);
});
