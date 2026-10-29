import { describe, expect, test } from "bun:test";
import { interviewInviteMissing } from "./view-model";

describe("interviewInviteMissing", () => {
  test("flags a scheduled interview that has no calendar event", () => {
    expect(
      interviewInviteMissing({ inviteSent: false, status: "scheduled" })
    ).toBe(true);
  });

  test("does not flag an interview whose invite went out", () => {
    expect(
      interviewInviteMissing({ inviteSent: true, status: "scheduled" })
    ).toBe(false);
  });

  test("does not flag cancelled or completed interviews", () => {
    expect(
      interviewInviteMissing({ inviteSent: false, status: "cancelled" })
    ).toBe(false);
    expect(
      interviewInviteMissing({ inviteSent: false, status: "completed" })
    ).toBe(false);
  });
});
