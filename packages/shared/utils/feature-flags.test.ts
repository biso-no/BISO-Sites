import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAG_GROUPS,
  FEATURE_FLAGS,
  getFlagDef,
  isKnownFlagKey,
  mergeFlagStates,
} from "./feature-flags";

const KEY_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

describe("FEATURE_FLAGS catalog", () => {
  it("has unique, lowercase, snake-ish keys", () => {
    const keys = FEATURE_FLAGS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(KEY_RE);
    }
  });

  it("gives every flag a known group, a title, and a description", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(FEATURE_FLAG_GROUPS).toContain(flag.group);
      expect(flag.title.length).toBeGreaterThan(0);
      expect(flag.description.length).toBeGreaterThan(0);
      expect(typeof flag.defaultEnabled).toBe("boolean");
    }
  });

  it("includes the expected operational kill switches with the right defaults", () => {
    const byKey = Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, f]));
    expect(byKey.expenses_module?.defaultEnabled).toBe(true);
    expect(byKey.expenses_ocr?.defaultEnabled).toBe(true);
    expect(byKey.payments_vipps?.defaultEnabled).toBe(true);
    // Stripe is off by default — must never be exposed until explicitly enabled.
    expect(byKey.payments_stripe?.defaultEnabled).toBe(false);
    expect(byKey.ai_admin_copilot?.defaultEnabled).toBe(true);
  });
});

describe("getFlagDef / isKnownFlagKey", () => {
  it("resolves known keys and rejects unknown ones", () => {
    expect(getFlagDef("payments_vipps")?.group).toBe("payments");
    expect(getFlagDef("nope")).toBeUndefined();
    expect(isKnownFlagKey("ai_admin_copilot")).toBe(true);
    expect(isKnownFlagKey("ai_admin_copilot_typo")).toBe(false);
  });
});

describe("mergeFlagStates", () => {
  it("returns catalog defaults when there are no DB rows", () => {
    const states = mergeFlagStates([]);
    expect(states.payments_stripe).toBe(false);
    expect(states.payments_vipps).toBe(true);
    expect(states.expenses_module).toBe(true);
  });

  it("lets a DB override win over the default", () => {
    const states = mergeFlagStates([
      { key: "payments_stripe", enabled: true },
      { key: "expenses_module", enabled: false },
    ]);
    expect(states.payments_stripe).toBe(true);
    expect(states.expenses_module).toBe(false);
    // Untouched flags keep their defaults.
    expect(states.payments_vipps).toBe(true);
  });

  it("ignores DB rows whose key is not in the catalog", () => {
    const states = mergeFlagStates([
      { key: "legacy_unknown_flag", enabled: true },
    ]);
    expect(states).not.toHaveProperty("legacy_unknown_flag");
    expect(Object.keys(states).sort()).toEqual(
      FEATURE_FLAGS.map((f) => f.key).sort()
    );
  });
});
