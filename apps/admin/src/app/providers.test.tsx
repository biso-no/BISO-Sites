import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Providers from "./providers";

test("mounts the application notification region", () => {
  const html = renderToStaticMarkup(
    <Providers>
      <div>Application</div>
    </Providers>
  );

  expect(html).toContain('aria-label="Notifications alt+T"');
});
