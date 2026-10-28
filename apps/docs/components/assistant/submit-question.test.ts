import { expect, test } from "bun:test";
import { submitQuestion } from "./submit-question";

// No DOM under bun test without a new dependency, so the submit handler both
// ask fields share is tested as a function. Enter in a text input submits its
// form; the landing test checks the input and an Ask submit button share one.
function field(question: string) {
  const calls: string[] = [];
  let prevented = false;
  submitQuestion(
    {
      preventDefault: () => {
        prevented = true;
      },
    },
    {
      question,
      ask: (q) => calls.push(`ask:${q}`),
      clear: () => calls.push("clear"),
      focus: () => calls.push("focus"),
    }
  );
  return { calls, prevented };
}

test("a submit never reloads the page", () => {
  expect(field("How do I deploy?").prevented).toBe(true);
  expect(field("  ").prevented).toBe(true);
});

test("a question is asked as typed, then the input clears", () => {
  const { calls } = field("How do I deploy?");
  expect(calls).toContain("ask:How do I deploy?");
  expect(calls.at(-1)).toBe("clear");
});

test("focus moves to the input before asking, so the panel returns it there", () => {
  // `ask` records the focused element as the one to hand focus back to.
  expect(field("How do I deploy?").calls).toEqual([
    "focus",
    "ask:How do I deploy?",
    "clear",
  ]);
});

test("a blank question asks nothing and keeps the input as it is", () => {
  for (const question of ["", "   ", "\n"]) {
    expect(field(question).calls).toEqual([]);
  }
});
