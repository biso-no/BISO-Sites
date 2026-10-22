import { describe, expect, test } from "bun:test";
import { resolveNotifyPush } from "./notify-push-guard";

describe("resolveNotifyPush", () => {
  test("a campus admin on National keeps the stored value", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: true,
        storedCampusId: "5",
        stored: false,
      })
    ).toBe(false);
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: false,
        storedCampusId: "5",
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
        storedCampusId: "5",
        stored: null,
      })
    ).toBe(false);
  });

  test("moving a notify-on Bergen item to National forces false", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: true,
        stored: true,
        storedCampusId: "1",
      })
    ).toBe(false);
  });

  test("re-saving an already-National item keeps stored true over requested false", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: false,
        requested: false,
        stored: true,
        storedCampusId: "5",
      })
    ).toBe(true);
  });

  test("a global admin on National gets the requested value", () => {
    expect(
      resolveNotifyPush({
        campusId: "5",
        isGlobalAdmin: true,
        requested: true,
        storedCampusId: "5",
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
        storedCampusId: "5",
        stored: false,
      })
    ).toBe(true);
    expect(
      resolveNotifyPush({
        campusId: null,
        isGlobalAdmin: false,
        requested: true,
        storedCampusId: "5",
        stored: undefined,
      })
    ).toBe(true);
  });
});
