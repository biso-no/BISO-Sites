import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StepRail } from "./ui";

const STEPS = ["Essentials", "Description", "Review"] as const;

test("StepRail numbers the steps in order and checks off the ones behind", () => {
  const markup = renderToStaticMarkup(
    <StepRail dirty={false} setStep={() => undefined} step={1} steps={STEPS} />
  );
  const positions = STEPS.map((name) => markup.indexOf(`<span>${name}</span>`));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // Step 1 is done (a check icon), steps 2 and 3 show their numbers.
  expect(markup).not.toContain(">01<");
  expect(markup).toContain(">02<");
  expect(markup).toContain(">03<");
  expect(markup).toContain("lucide-check");
  expect(markup).not.toContain("Unsaved");
});

test("StepRail shows Unsaved while there are changes", () => {
  expect(
    renderToStaticMarkup(
      <StepRail dirty setStep={() => undefined} step={0} steps={STEPS} />
    )
  ).toContain("Unsaved");
});
