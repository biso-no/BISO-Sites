// @vitest-environment happy-dom
import { Activity, act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { PageThemeStyleClient } from "./page-theme-style-client";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it("the sheet is off while its Activity is hidden and on when shown again", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = (mode: "visible" | "hidden") =>
    act(() => {
      root.render(
        <Activity mode={mode}>
          <PageThemeStyleClient css=":root{--biso-deep:#3b1c6b}" />
        </Activity>
      );
    });

  await show("visible");
  const style = container.querySelector("style") as HTMLStyleElement;
  expect(style.media).toBe("all");
  expect(style.hasAttribute("href")).toBe(false);

  await show("hidden");
  expect(container.querySelector("style")?.media).toBe("not all");

  await show("visible");
  expect(container.querySelector("style")?.media).toBe("all");

  await act(async () => root.unmount());
});
