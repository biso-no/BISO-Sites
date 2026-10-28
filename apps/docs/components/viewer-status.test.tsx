import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ViewerStatusView } from "./viewer-status";

const ADMIN = "https://admin.biso.no";
const HERE = "https://docs.biso.no/it/guide?a=1";

test("renders nothing before the viewer is known", () => {
  expect(
    renderToStaticMarkup(
      <ViewerStatusView adminUrl={ADMIN} currentUrl={HERE} viewer={null} />
    )
  ).toBe("");
});

test("renders nothing when the admin url is unset", () => {
  expect(
    renderToStaticMarkup(
      <ViewerStatusView
        adminUrl={undefined}
        currentUrl={HERE}
        viewer={{ signedIn: false, canSeePrivate: false }}
      />
    )
  ).toBe("");
});

test("signed out links to the admin login and back to this page", () => {
  const html = renderToStaticMarkup(
    <ViewerStatusView
      adminUrl={ADMIN}
      currentUrl={HERE}
      viewer={{ signedIn: false, canSeePrivate: false }}
    />
  );
  expect(html).toContain(
    `href="${ADMIN}/auth/login?redirectTo=${encodeURIComponent(HERE)}"`
  );
  expect(html).toContain("Sign in");
});

test("signed in shows the first name and no private marker", () => {
  const html = renderToStaticMarkup(
    <ViewerStatusView
      adminUrl={ADMIN}
      currentUrl={HERE}
      viewer={{ signedIn: true, name: "Kari Nordmann", canSeePrivate: false }}
    />
  );
  expect(html).toContain("Kari");
  expect(html).not.toContain("Nordmann");
  expect(html).not.toContain("Private details on");
  expect(html).not.toContain("Sign in");
});

test("signed in with access shows the private marker", () => {
  const html = renderToStaticMarkup(
    <ViewerStatusView
      adminUrl={ADMIN}
      currentUrl={HERE}
      viewer={{ signedIn: true, name: "Kari Nordmann", canSeePrivate: true }}
    />
  );
  expect(html).toContain("Private details on");
});
