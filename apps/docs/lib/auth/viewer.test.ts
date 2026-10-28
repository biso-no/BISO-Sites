import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getViewer } from "./viewer";

const SOURCE = readFileSync(new URL("./viewer.ts", import.meta.url), "utf8");

const fail = () => Promise.reject(new Error("401"));

describe("getViewer", () => {
  test("signed out when the account cannot be loaded", async () => {
    const viewer = await getViewer({
      loadAccount: fail,
      loadTeams: () => Promise.resolve([]),
    });
    expect(viewer).toEqual({ signedIn: false });
  });

  test("signed in with null access when the teams cannot be loaded", async () => {
    const viewer = await getViewer({
      loadAccount: () => Promise.resolve({ name: "Ada" }),
      loadTeams: fail,
    });
    expect(viewer).toEqual({ signedIn: true, name: "Ada", access: null });
  });

  test("a global admin's teams give globaladmin", async () => {
    const viewer = await getViewer({
      loadAccount: () => Promise.resolve({ name: "Ada" }),
      loadTeams: () =>
        Promise.resolve([
          { $id: "a", name: "SG-App-Campus-National" },
          { $id: "b", name: "SG-App-Dept-OperationsUnit" },
        ]),
    });
    expect(viewer).toEqual({
      signedIn: true,
      name: "Ada",
      access: "globaladmin",
    });
  });

  test("never uses the admin client or sets cookies", () => {
    expect(SOURCE).not.toContain("createAdminClient");
    expect(SOURCE).not.toContain("cookies().set");
    expect(SOURCE).not.toContain("createSession(");
    expect(SOURCE).not.toContain("setCookie");
  });
});
