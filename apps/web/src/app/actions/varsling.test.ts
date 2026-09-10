import { beforeEach, describe, expect, it, vi } from "vitest";

const adminDb = vi.hoisted(() => ({
  getRow: vi.fn(),
}));

const sendEmail = vi.hoisted(() => vi.fn());

const createAdminClient = vi.hoisted(() =>
  vi.fn(async () => ({ db: adminDb }))
);

vi.mock("@repo/api/server", () => ({
  createAdminClient,
  createSessionClient: vi.fn(async () => ({ db: { listRows: vi.fn() } })),
}));

const isSmtpConfigured = vi.hoisted(() => vi.fn(() => true));
// The real predicate, not a stub: the action's branch is only meaningful
// if it agrees with how the transport actually marks a refusal.
const isCertainNonDelivery = vi.hoisted(
  () => (error: unknown) =>
    error instanceof Error &&
    ((error as { smtpRecipientsRefused?: true }).smtpRecipientsRefused ===
      true ||
      (error as { code?: string }).code === "EENVELOPE")
);

vi.mock("@repo/connectors/email", () => ({
  isCertainNonDelivery,
  isSmtpConfigured,
  sendEmail,
}));

const clientIp = vi.hoisted(() => ({ value: "203.0.113.1" }));

// The limiter identifies nobody unless the deployment declares where a
// trustworthy address comes from; one appending ingress is the shape here.
process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS = "1";

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve(new Headers({ "x-forwarded-for": clientIp.value }))
  ),
}));

import { submitVarslingCase } from "./varsling";

const SUBMISSIONS_PER_WINDOW = 5;

const TRY_AGAIN = /try again/i;
const NOT_DELIVERED = /could NOT be delivered/;
const UNCONFIRMED = /could not confirm/i;
const CONTACT_DIRECTLY = /directly/;

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
    createAdminClient.mockImplementation(async () => ({ db: adminDb }));
    isSmtpConfigured.mockReturnValue(true);
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

  it("holds the cap against a batch fired all at once", async () => {
    mockSettingLookup(ACTIVE_SETTING);

    // The bypass this guards: every request clears the early check while the
    // others are still awaiting Appwrite, so a split check-then-increment lets
    // the whole batch send. Only an atomic reservation holds the line.
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        submitVarslingCase({
          case_description: `Samtidig sak ${i}`,
          setting_id: "setting-1",
          submission_type: "other",
        })
      )
    );

    const delivered = results.filter((result) => result.success);

    expect(delivered).toHaveLength(SUBMISSIONS_PER_WINDOW);
    expect(sendEmail).toHaveBeenCalledTimes(SUBMISSIONS_PER_WINDOW);
  });

  it("tells the reporter their report did not arrive when SMTP is unset", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    isSmtpConfigured.mockReturnValue(false);
    mockSettingLookup(ACTIVE_SETTING);

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(result.success).toBe(false);
    // Never "try again" — that reads as "it might have worked".
    expect(result.error).not.toMatch(TRY_AGAIN);
    expect(result.error).toMatch(NOT_DELIVERED);
    expect(result.error).toMatch(CONTACT_DIRECTLY);
    // No Appwrite work and no rate-limit slot spent on a doomed submission.
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("claims certain non-delivery only when the relay refused everyone", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSettingLookup(ACTIVE_SETTING);

    // What a real relay produces for "no such user": nodemailer raises
    // EENVELOPE before sendEmail's accepted-nobody check is reached.
    const refused = Object.assign(
      new Error("Can't send mail - all recipients were rejected: 550"),
      { code: "EENVELOPE" }
    );
    sendEmail.mockRejectedValue(refused);

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(result.error).toMatch(NOT_DELIVERED);
    // The reason survives into the logs — it is the only record of the report.
    expect(consoleError).toHaveBeenCalledWith(
      "[varsling] Failed to deliver a report:",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("does not claim non-delivery when the connection dropped mid-send", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSettingLookup(ACTIVE_SETTING);

    // SMTP's in-doubt window: DATA was sent and the relay's final 250 never
    // came back. The report may already be queued on the far side, so telling
    // the reporter it definitely failed could have them re-file a sensitive
    // disclosure that already arrived.
    sendEmail.mockRejectedValue(
      Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" })
    );

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(UNCONFIRMED);
    expect(result.error).not.toMatch(NOT_DELIVERED);
    // Still routed to a person — an unconfirmed report must not read as fine.
    expect(result.error).toMatch(CONTACT_DIRECTLY);
    consoleError.mockRestore();
  });

  it("is certain about non-delivery when it never reached the relay", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    // A misconfigured deployment: no APPWRITE_API_KEY, so the client throws
    // long before SMTP is involved.
    createAdminClient.mockImplementation(() => {
      throw new Error("APPWRITE_API_KEY is not configured");
    });

    const result = await submitVarslingCase({
      case_description: "Sak",
      setting_id: "setting-1",
      submission_type: "other",
    });

    expect(result.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    // Nothing was sent, so there is no possible duplicate to warn anyone about.
    expect(result.error).toMatch(NOT_DELIVERED);
    expect(result.error).not.toMatch(UNCONFIRMED);
    consoleError.mockRestore();
  });
});
