import { expect, test } from "bun:test";
import { hasRichContent } from "./plate-content";

test("counts URL-bearing Plate media as content", () => {
  expect(
    hasRichContent(
      JSON.stringify([
        {
          children: [{ text: "" }],
          type: "img",
          url: "https://example.com/image.jpg",
        },
      ])
    )
  ).toBeTrue();
});

test("keeps an empty Plate paragraph empty", () => {
  expect(
    hasRichContent(JSON.stringify([{ children: [{ text: "" }], type: "p" }]))
  ).toBeFalse();
});
