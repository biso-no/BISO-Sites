import { expect, test } from "bun:test";
import { adoptRuntimeApiKey } from "./runtime-key";

test("copies the per-execution x-appwrite-key header into the env", () => {
  const env: Record<string, string | undefined> = {};
  adoptRuntimeApiKey({ "x-appwrite-key": "ephemeral" }, env);
  expect(env.APPWRITE_FUNCTION_API_KEY).toBe("ephemeral");
});

test("leaves the env alone when the header is missing (local run)", () => {
  const env: Record<string, string | undefined> = {
    APPWRITE_FUNCTION_API_KEY: "existing",
  };
  adoptRuntimeApiKey({}, env);
  adoptRuntimeApiKey(undefined, env);
  expect(env.APPWRITE_FUNCTION_API_KEY).toBe("existing");
});
