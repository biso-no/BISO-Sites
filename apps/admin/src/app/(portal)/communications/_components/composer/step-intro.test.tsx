import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StepIntro } from "./ui";

test("StepIntro renders the eyebrow above a 40px serif title", () => {
  expect(
    renderToStaticMarkup(<StepIntro eyebrow="Step 2" title="The message." />)
  ).toBe(
    renderToStaticMarkup(
      <div style={{ padding: "8px 0 18px" }}>
        <span
          style={{
            color: "#9c9385",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Step 2
        </span>
        <div
          style={{
            color: "#1a1814",
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
            marginTop: 4,
          }}
        >
          The message.
        </div>
      </div>
    )
  );
});
