import { describe, expect, it } from "bun:test";
import { createPrivateBatcher, fetchPrivateBatch } from "./batcher";

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("private batcher windows", () => {
  const okAll = (names: string[]) =>
    Promise.resolve(
      Object.fromEntries(names.map((n) => [n, { state: "ok", value: n }]))
    );

  it("splits more than 20 names into several requests", async () => {
    const calls: string[][] = [];
    const request = createPrivateBatcher((names) => {
      calls.push(names);
      return okAll(names);
    });
    const names = Array.from({ length: 25 }, (_, i) => `n${i}`);
    await Promise.all(names.map((n) => request(n as any)));
    expect(calls.map((c) => c.length)).toEqual([20, 5]);
  });

  it("gives every waiter unavailable when the request fails", async () => {
    const request = createPrivateBatcher(() => Promise.reject(new Error("x")));
    const all = await Promise.all([
      request("account-owners"),
      request("infisical-url"),
    ]);
    expect(all).toEqual([{ state: "unavailable" }, { state: "unavailable" }]);
  });

  it("uses a separate request for a later window", async () => {
    const calls: string[][] = [];
    const request = createPrivateBatcher((names) => {
      calls.push(names);
      return okAll(names);
    });
    await request("account-owners");
    await wait(20);
    await request("account-owners");
    expect(calls.length).toBe(2);
  });
});

describe("fetchPrivateBatch", () => {
  const original = globalThis.fetch;
  const reply = (status: number, body: unknown) => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(body), { status })
      )) as unknown as typeof fetch;
  };
  const restore = () => {
    globalThis.fetch = original;
  };

  it("maps an ok response and a missing value", async () => {
    reply(200, { state: "ok", values: { "account-owners": "Ada" } });
    const out = await fetchPrivateBatch(["account-owners", "infisical-url"]);
    restore();
    expect(out["account-owners"]).toEqual({ state: "ok", value: "Ada" });
    expect(out["infisical-url"]).toEqual({ state: "unavailable" });
  });

  it("treats a non-ok HTTP status as unavailable", async () => {
    reply(500, { state: "ok", values: { "account-owners": "Ada" } });
    const out = await fetchPrivateBatch(["account-owners"]);
    restore();
    expect(out["account-owners"]).toBeUndefined();
  });

  it("treats an unknown state as unavailable and passes known ones", async () => {
    reply(200, { state: "weird" });
    let out = await fetchPrivateBatch(["account-owners"]);
    expect(out["account-owners"]).toEqual({ state: "unavailable" });
    reply(200, { state: "forbidden" });
    out = await fetchPrivateBatch(["account-owners"]);
    restore();
    expect(out["account-owners"]).toEqual({ state: "forbidden" });
  });
});
