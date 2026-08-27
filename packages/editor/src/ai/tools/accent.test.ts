import { expect, test } from "bun:test";
import { applyAccentInputSchema } from "./index";

test("the AI accent tool accepts only approved brand swatches", () => {
  const schema = applyAccentInputSchema;

  expect(schema.safeParse({ hex: "#3DA9E0" }).success).toBe(true);
  expect(schema.safeParse({ hex: "#6b1e1e" }).success).toBe(false);
  expect(schema.safeParse({ hex: "#ff00ff" }).success).toBe(false);
});
