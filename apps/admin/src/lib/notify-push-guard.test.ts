import { describe, expect, test } from "bun:test";
import { resolveNotifyPush } from "./notify-push-guard";

describe("resolveNotifyPush", () => {
  test("a campus admin on National keeps the stored value", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: true,
        stored: false,
      })
    ).toBe(false);
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: false,
        stored: true,
      })
    ).toBe(true);
  });

  test("a campus admin on National creating content gets false", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: true,
        stored: null,
      })
    ).toBe(false);
  });

  test("a global admin on National gets the requested value", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: true,
        requested: true,
        stored: false,
      })
    ).toBe(true);
  });

  test("anyone on another campus gets the requested value", () => {
    expect(
      resolveNotifyPush({
        campusId: "1",
        isGlobalAdmin: false,
        requested: true,
        stored: false,
      })
    ).toBe(true);
    expect(
      resolveNotifyPush({
        campusId: null,
        isGlobalAdmin: false,
        requested: true,
        stored: undefined,
      })
    ).toBe(true);
  });
});
