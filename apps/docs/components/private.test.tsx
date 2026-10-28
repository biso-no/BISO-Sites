import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Private, PrivateView } from "./private";

const ADMIN = "https://admin.biso.no";
const HERE = "https://docs.biso.no/it/guide?a=1";

test("server output has only a placeholder", () => {
  const html = renderToStaticMarkup(<Private name="account-owners" />);
  expect(html).toContain("aria-busy");
  expect(html).not.toContain("Sign in");
});

test("signed-out shows the message and a sign-in link", () => {
  const html = renderToStaticMarkup(
    <PrivateView
      adminUrl={ADMIN}
      currentUrl={HERE}
      result={{ state: "signed-out" }}
    />
  );
  expect(html).toContain("Sign in with your BISO admin account to see this.");
  expect(html).toContain(
    `href="${ADMIN}/auth/login?redirectTo=${encodeURIComponent(HERE).replace(/&/g, "&amp;")}"`
  );
  expect(html).toContain("focus-visible:outline-2");
});

test("signed-out omits the link when the admin url is unset", () => {
  const html = renderToStaticMarkup(
    <PrivateView result={{ state: "signed-out" }} />
  );
  expect(html).not.toContain("<a");
});

test("forbidden and unavailable show their copy without a link", () => {
  const forbidden = renderToStaticMarkup(
    <PrivateView adminUrl={ADMIN} result={{ state: "forbidden" }} />
  );
  expect(forbidden).toContain("Your account doesn&#x27;t have access to this.");
  expect(forbidden).not.toContain("<a");
  const down = renderToStaticMarkup(
    <PrivateView adminUrl={ADMIN} result={{ state: "unavailable" }} />
  );
  expect(down).toContain(
    "This couldn&#x27;t be loaded right now. Try again later."
  );
});

test("an ok value is shown with a copy button", () => {
  const html = renderToStaticMarkup(
    <PrivateView label="owners" result={{ state: "ok", value: "Ada" }} />
  );
  expect(html).toContain("Ada");
  expect(html).toContain('aria-label="Copy owners"');
});
