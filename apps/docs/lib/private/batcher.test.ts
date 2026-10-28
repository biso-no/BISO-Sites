import { describe, expect, it } from "bun:test";
import { createPrivateBatcher } from "./batcher";

describe("private batcher", () => {
  it("sends one request for every name asked for together", async () => {
    const calls: string[][] = [];
    const request = createPrivateBatcher((names) => {
      calls.push(names);
      return Promise.resolve(
        Object.fromEntries(
          names.map((n) => [n, { state: "ok", value: `v-${n}` }])
        )
      );
    });
    const [a, b, a2] = await Promise.all([
      request("account-owners"),
      request("infisical-url"),
      request("account-owners"),
    ]);
    expect(calls).toEqual([["account-owners", "infisical-url"]]);
    expect(a).toEqual({ state: "ok", value: "v-account-owners" });
    expect(b).toEqual({ state: "ok", value: "v-infisical-url" });
    expect(a2).toEqual(a);
  });

  it("falls back to unavailable when the request fails", async () => {
    const request = createPrivateBatcher(() =>
      Promise.reject(new Error("offline"))
    );
    expect(await request("account-owners")).toEqual({ state: "unavailable" });
  });
});
