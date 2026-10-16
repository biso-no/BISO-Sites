import { describe, expect, test } from "bun:test";
import { REPEAT_WINDOW_MS, recordSighting, scanRepeatKey } from "./scan-repeat";

const SIGNATURE = "c2lnbmF0dXJl";

describe("scanRepeatKey", () => {
  test("uses the member id of web, Apple and Google codes", () => {
    expect(scanRepeatKey(`v1.user123.100.${SIGNATURE}`)).toBe("member:user123");
    expect(scanRepeatKey(`a1.user123.20270101.${SIGNATURE}`)).toBe(
      "member:user123"
    );
    expect(scanRepeatKey("g1.user123.123456")).toBe("member:user123");
  });

  test("falls back to the whole string when the code does not parse", () => {
    expect(scanRepeatKey("hello world")).toBe("hello world");
    expect(scanRepeatKey("v1.100")).toBe("v1.100");
    expect(scanRepeatKey("constructor.a.b.c")).toBe("constructor.a.b.c");
  });
});

describe("recordSighting", () => {
  test("ignores a different code for the same member within the window", () => {
    const first = recordSighting(null, `v1.user123.100.${SIGNATURE}`, 0);
    expect(first.repeat).toBe(false);
    const second = recordSighting(
      first.sighting,
      `v1.user123.101.${SIGNATURE}`,
      5000
    );
    expect(second.repeat).toBe(true);
  });

  test("restarts the window each time the pass is seen", () => {
    const code = "g1.user123.123456";
    let last = recordSighting(null, code, 0).sighting;
    for (const at of [15_000, 30_000, 45_000]) {
      const next = recordSighting(last, code, at);
      expect(next.repeat).toBe(true);
      last = next.sighting;
    }
  });

  test("accepts the pass again once it has not been seen for the window", () => {
    const code = `v1.user123.100.${SIGNATURE}`;
    const first = recordSighting(null, code, 0);
    expect(
      recordSighting(first.sighting, code, REPEAT_WINDOW_MS - 1).repeat
    ).toBe(true);
    expect(recordSighting(first.sighting, code, REPEAT_WINDOW_MS).repeat).toBe(
      false
    );
  });

  test("accepts a different member straight away", () => {
    const first = recordSighting(null, `v1.userA.100.${SIGNATURE}`, 0);
    expect(
      recordSighting(first.sighting, `v1.userB.100.${SIGNATURE}`, 1000).repeat
    ).toBe(false);
  });

  test("matches unparseable strings exactly", () => {
    const first = recordSighting(null, "garbage", 0);
    expect(recordSighting(first.sighting, "garbage", 1000).repeat).toBe(true);
    expect(recordSighting(first.sighting, "garbage2", 1000).repeat).toBe(false);
  });
});
