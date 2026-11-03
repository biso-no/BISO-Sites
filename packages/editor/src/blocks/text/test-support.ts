// Test-only helpers for the text block.
import { act, createElement, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RichTextField } from "./lazy-field";
import { RICH_CLASS } from "./render-classes";

/**
 * `RICH_CLASS` as React writes it into a class attribute, with `&` and `>`
 * escaped, for tests that compare exact markup.
 */
export const RICH_ATTR = RICH_CLASS.replaceAll("&", "&amp;").replaceAll(
  ">",
  "&gt;"
);

/**
 * Loads the lazy rich text field and draws it once, so a canvas a test
 * draws later shows the field at once, whatever the file order, rather than
 * a tick after an `act` has ended. Needs the DOM globals Plate reads.
 */
export async function loadRichField(): Promise<void> {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(
      createElement(
        Suspense,
        null,
        createElement(RichTextField, {
          html: "",
          label: "",
          onChange: () => undefined,
          variant: "panel",
        })
      )
    );
    await import("./rich/field");
    await Promise.resolve();
  });
  act(() => root.unmount());
}
