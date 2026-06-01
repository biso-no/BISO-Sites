import { describe, expect, test } from "bun:test";
import {
  normalizeAdminPortalSettingsFromPrefs,
  normalizeAdminPortalSettingsInput,
} from "./settings-model";

describe("admin portal settings model", () => {
  test("uses existing top-level locale preference for compatibility", () => {
    const settings = normalizeAdminPortalSettingsFromPrefs({
      adminPortalSettings: {
        timezone: "UTC",
      },
      locale: "en",
    });

    expect(settings.locale).toBe("en");
    expect(settings.timezone).toBe("UTC");
  });

  test("falls back when stored preferences are incomplete", () => {
    const settings = normalizeAdminPortalSettingsFromPrefs({
      adminPortalSettings: {
        notifications: {
          newApplications: false,
        },
      },
    });

    expect(settings.notifications).toEqual({
      newApplications: false,
      newDrafts: true,
      systemAlerts: false,
    });
    expect(settings.timezone).toBe("Europe/Oslo");
  });

  test("rejects invalid save payloads", () => {
    expect(() =>
      normalizeAdminPortalSettingsInput({
        locale: "de",
        notifications: {
          newApplications: true,
          newDrafts: true,
          systemAlerts: false,
        },
        timezone: "Europe/Oslo",
      })
    ).toThrow("Unsupported locale");
  });
});
