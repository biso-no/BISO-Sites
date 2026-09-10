import { beforeEach, describe, expect, it, vi } from "vitest";

const adminDb = vi.hoisted(() => ({
  getRow: vi.fn(),
}));

const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ db: { listRows: vi.fn() } })),
}));

vi.mock("@repo/connectors/email", () => ({ sendEmail }));

const clientIp = vi.hoisted(() => ({ value: "203.0.113.1" }));

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve(new Headers({ "x-forwarded-for": clientIp.value }))
  ),
}));

import { submitVarslingCase } from "./varsling";

const SUBMISSIONS_PER_WINDOW = 5;

/**
 * The rate limiter is module-level state shared by every test in this file, so
 * each test claims its own address rather than resetting it.
 */
let nextIpOctet = 1;
function useFreshClient() {
  nextIpOctet += 1;
  clientIp.value = `203.0.113.${nextIpOctet}`;
}

const ACTIVE_SETTING = {
  $id: "setting-1",
  campus_id: "1",
  email: "hr@biso.no",
  is_active: true,
  role_name: "Tanweer Akram – HR-sjef",
};

function mockSettingLookup(setting: Record<string, unknown>) {
  adminDb.getRow.mockImplementation((_db: string, table: string) => {
    if (table === "varsling_settings") {
      return Promise.resolve(setting);
    }
    return Promise.resolve({ name: "Oslo" });
  });
}

describe("submitVarslingCase", () => {
  beforeEach(() => {
    useFreshClient();
    adminDb.getRow.mockReset();
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({
      accepted: ["hr@biso.no"],
      messageId: "<1@biso.no>",
      rejected: [],
    });
  });

  it("mails the address stored on the setting, never one from the client", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    const result = await submitVarslingCase({
      case_description: "Noe kritikkverdig har skjedd.",
      setting_id: "setting-1",
      submission_type: "harassment",
      // A client that smuggles an address in must not be able to steer delivery.
      submitter_email: "reporter@example.com",
    });

    expect(result).toEqual({ success: true });
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("hr@biso.no");
    expect(sent.subject).toBe("BISO Varsling: Trakassering");
    expect(sent.replyTo).toBe("reporter@example.com");
    expect(sent.text).toContain("Noe kritikkverdig har skjedd.");
  });

  it("leaves an anonymous report without a reply-to address", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    const result = await submitVarslingCase({
      case_description: "Anonymt varsel.",
      setting_id: "setting-1",
      submission_type: "witness",
    });

    expect(result).toEqual({ success: true });
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.replyTo).toBeUndefined();
    expect(sent.text).toContain("Kontakt: Anonym");
    expect(sent.html).toContain("Anonym");
  });

  it("escapes HTML from the reporter instead of injecting it into the body", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    await submitVarslingCase({
      case_description: "<script>alert(1)</script>",
      setting_id: "setting-1",
      submission_type: "other",
    });

    const sent = sendEmail.mock.calls[0][0];
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&lt;script&gt;");
  });

  it("refuses a deactivated contact without sending anything", async () => {
    mockSettingLookup({ ...ACTIVE_SETTING, is_active: false });

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(result.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports failure when the relay rejects the message", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSettingLookup(ACTIVE_SETTING);
    sendEmail.mockRejectedValue(new Error("SMTP is not configured"));

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    // The reporter must be told, so they can fall back to the escalation
    // contacts the form lists rather than believing the case was filed.
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    consoleError.mockRestore();
  });

  it("rejects a malformed contact address before any lookup", async () => {
    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
      submitter_email: "not-an-email",
    });

    expect(result.success).toBe(false);
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stops a flood from one client once the window is spent", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    for (let i = 0; i < SUBMISSIONS_PER_WINDOW; i++) {
      const result = await submitVarslingCase({
        case_description: `Sak ${i}`,
        setting_id: "setting-1",
        submission_type: "other",
      });
      expect(result.success).toBe(true);
    }

    const blocked = await submitVarslingCase({
      case_description: "En til",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(blocked.success).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(SUBMISSIONS_PER_WINDOW);
    // The reporter is told what to do instead, never just refused.
    expect(blocked.error).toContain("wait a few minutes");
  });

  it("does not let one client's flood block another reporter", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    for (let i = 0; i < SUBMISSIONS_PER_WINDOW + 1; i++) {
      await submitVarslingCase({
        case_description: `Sak ${i}`,
        setting_id: "setting-1",
        submission_type: "other",
      });
    }

    useFreshClient();
    const other = await submitVarslingCase({
      case_description: "Uavhengig sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(other.success).toBe(true);
  });

  it("does not spend the allowance on a rejected submission", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    for (let i = 0; i < SUBMISSIONS_PER_WINDOW + 2; i++) {
      const rejected = await submitVarslingCase({
        case_description: "Sak",
        setting_id: "setting-1",
        submission_type: "other",
        submitter_email: "not-an-email",
      });
      expect(rejected.success).toBe(false);
    }

    // A reporter who mistyped their address several times can still file.
    const accepted = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(accepted.success).toBe(true);
  });
});
