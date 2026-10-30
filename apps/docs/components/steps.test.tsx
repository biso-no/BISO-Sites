import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Step, Steps } from "./steps";

test("a step's heading carries the id it is given", () => {
  const html = renderToStaticMarkup(
    <Steps>
      <Step
        id="shortlist-or-archive-a-candidate-1"
        title="Shortlist or archive a candidate"
      >
        <p>Move them.</p>
      </Step>
    </Steps>
  );
  expect(html).toContain(
    '<h3 class="mb-2 scroll-m-28 font-semibold text-lg" id="shortlist-or-archive-a-candidate-1">'
  );
});

test("without an id, the heading's id comes from the title", () => {
  const html = renderToStaticMarkup(
    <Step title="Shortlist or archive a candidate">
      <p>Move them.</p>
    </Step>
  );
  expect(html).toContain('id="shortlist-or-archive-a-candidate"');
});

test("a step without a title has no heading", () => {
  const html = renderToStaticMarkup(
    <Step>
      <p>Move them.</p>
    </Step>
  );
  expect(html).not.toContain("<h3");
  expect(html).not.toContain("id=");
});
