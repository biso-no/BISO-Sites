import { describe, expect, test } from "bun:test";
import { reachPile } from "./reach";

describe("reachPile", () => {
  const push = new Set(["u-push"]);

  test("a linked account with a push target gets a push", () => {
    expect(reachPile({ user_id: "u-push" }, push)).toBe("push");
  });

  test("a linked account without a push target is connected and gets email", () => {
    expect(reachPile({ user_id: "u-quiet" }, push)).toBe("app_no_push");
  });

  test("an unlinked participant gets an email", () => {
    expect(reachPile({ user_id: null }, push)).toBe("email");
  });
});
