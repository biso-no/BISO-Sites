import { expect, test } from "bun:test";
import type { ImageBlock, PageDoc } from "@/editor/types";
import { pickersIn } from "@/lib/test-tree";
import { ImageInspector } from "./inspector";

const block: ImageBlock = {
  alt: "",
  caption: "",
  frame: "chevron",
  id: "i1",
  lean: "left",
  ratio: "16/9",
  type: "image",
};

test("an upload stores its mime type; a linked or cleared image has none", () => {
  const patches: [string, unknown][] = [];
  const [picker] = pickersIn(
    ImageInspector({
      block,
      doc: {} as PageDoc,
      onPatch: (path, value) => patches.push([path, value]),
    })
  );
  picker?.props.onPicked(
    "f-1",
    "https://x/v1/storage/buckets/m/files/f-1/view",
    "image/svg+xml"
  );
  expect(patches).toContainEqual(["mime", "image/svg+xml"]);
  expect(patches).toContainEqual(["fileId", "f-1"]);

  patches.length = 0;
  picker?.props.onUrl("https://cdn.example/a.jpg");
  expect(patches).toContainEqual(["mime", undefined]);

  patches.length = 0;
  picker?.props.onClear?.();
  expect(patches).toContainEqual(["mime", undefined]);
});
