import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BeforeYouStart } from "./before-you-start";
import { WhatHappensNext } from "./what-happens-next";

const BEFORE_TITLE = /Before you start/g;
const NEXT_TITLE = /What happens next/g;

// The author's own `## …` heading is the panel's title, so the TOC lists it;
// a built-in title would print it twice.
test("BeforeYouStart adds no title of its own", () => {
  const html = renderToStaticMarkup(
    <BeforeYouStart>
      <h2>Before you start</h2>
      <p>Know the deadline.</p>
    </BeforeYouStart>
  );
  expect(html.match(BEFORE_TITLE)?.length).toBe(1);
  expect(html).toContain("Know the deadline.");
});

test("WhatHappensNext adds no title of its own", () => {
  const html = renderToStaticMarkup(
    <WhatHappensNext>
      <h2>What happens next</h2>
      <p>The app sends a push.</p>
    </WhatHappensNext>
  );
  expect(html.match(NEXT_TITLE)?.length).toBe(1);
  expect(html).toContain("The app sends a push.");
});
