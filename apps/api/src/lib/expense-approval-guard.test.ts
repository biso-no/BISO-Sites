import { NATIONAL_APPROVER_EMAIL } from "@repo/shared/utils/expense-approvers";
import { describe, expect, it } from "vitest";
import { guardChain } from "./expense-approval-guard";
import type { ResolvedApproverStep } from "./expense-approver-resolution";

const CONTEXT = { campusId: "1", departmentName: "Marketing" };

const step = (
  role: ResolvedApproverStep["role"],
  email: string,
  n: number
): ResolvedApproverStep => ({
  aadId: "aad",
  directoryKey: `key:${role}`,
  email,
  role,
  source: "directory",
  step: n,
});

const guard = (steps: ResolvedApproverStep[], submitter: string | null) =>
  guardChain(CONTEXT, { issues: [], steps }, submitter);

describe("guardChain", () => {
  it("leaves a clean chain alone", () => {
    const steps = [
      step("finance", "a@biso.no", 1),
      step("controller", "b@biso.no", 2),
    ];
    expect(guard(steps, "me@biso.no")).toEqual({ issues: [], steps });
  });

  it("sends a controller who is the submitter to the campus default", () => {
    const { steps, issues } = guard(
      [step("controller", "me@biso.no", 1)],
      " Me@BISO.no"
    );
    expect(steps).toEqual([
      {
        aadId: null,
        directoryKey: null,
        email: "controller.oslo@biso.no",
        fallbackFor: undefined,
        role: "controller",
        source: "default",
        step: 1,
      },
    ]);
    expect(issues).toEqual([
      expect.objectContaining({
        reason:
          "Approver is the submitter; sent to controller.oslo@biso.no instead",
        roleSought: "controller",
      }),
    ]);
  });

  it("goes on to national when the campus default is the submitter too", () => {
    const { steps } = guard(
      [step("controller", "controller.oslo@biso.no", 1)],
      "controller.oslo@biso.no"
    );
    expect(steps).toEqual([
      expect.objectContaining({
        directoryKey: null,
        email: NATIONAL_APPROVER_EMAIL,
        fallbackFor: "controller",
        role: "national",
      }),
    ]);
  });

  it("sends a president who is the submitter to national, marked as the fallback", () => {
    const { steps } = guard([step("president", "me@biso.no", 1)], "me@biso.no");
    expect(steps).toEqual([
      expect.objectContaining({
        directoryKey: null,
        fallbackFor: "president",
        role: "national",
        source: "default",
        step: 1,
      }),
    ]);
  });

  it("drops a department step that is the submitter, with an issue", () => {
    const { steps, issues } = guard(
      [step("finance", "me@biso.no", 1), step("controller", "c@biso.no", 2)],
      "me@biso.no"
    );
    expect(steps.map((s) => [s.step, s.role])).toEqual([[1, "controller"]]);
    expect(issues).toEqual([
      expect.objectContaining({
        reason: "Approver is the submitter",
        roleSought: "finance",
      }),
    ]);
  });

  it("sends a national step pointed at the submitter to the national mailbox", () => {
    const { steps, issues } = guard(
      [step("national", "me@biso.no", 1)],
      "me@biso.no"
    );
    expect(steps).toEqual([
      {
        aadId: null,
        directoryKey: null,
        email: NATIONAL_APPROVER_EMAIL,
        fallbackFor: undefined,
        role: "national",
        source: "default",
        step: 1,
      },
    ]);
    expect(issues).toEqual([
      expect.objectContaining({
        reason: `Approver is the submitter; sent to ${NATIONAL_APPROVER_EMAIL} instead`,
        roleSought: "national",
      }),
    ]);
  });

  it("keeps the president fallback label when the national step is the submitter", () => {
    const { steps } = guard(
      [{ ...step("national", "me@biso.no", 1), fallbackFor: "president" }],
      "me@biso.no"
    );
    expect(steps).toEqual([
      expect.objectContaining({
        email: NATIONAL_APPROVER_EMAIL,
        fallbackFor: "president",
        role: "national",
      }),
    ]);
  });

  it("drops a national step when the national mailbox is the submitter", () => {
    const { steps, issues } = guard(
      [step("national", NATIONAL_APPROVER_EMAIL, 1)],
      NATIONAL_APPROVER_EMAIL
    );
    expect(steps).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ reason: "Approver is the submitter" }),
    ]);
  });

  it("leaves no steps when every candidate is the submitter", () => {
    const none = guard(
      [step("president", NATIONAL_APPROVER_EMAIL, 1)],
      NATIONAL_APPROVER_EMAIL
    );
    expect(none.steps).toEqual([]);
    expect(none.issues).toEqual([
      expect.objectContaining({ reason: "Approver is the submitter" }),
    ]);
  });

  it("drops the earlier of two steps with the same approver and renumbers", () => {
    const { steps, issues } = guard(
      [
        step("finance", "same@biso.no", 1),
        step("controller", " Same@biso.no", 2),
        step("president", "p@biso.no", 3),
      ],
      null
    );
    expect(steps.map((s) => [s.step, s.role])).toEqual([
      [1, "controller"],
      [2, "president"],
    ]);
    expect(issues).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining("earlier finance step was dropped"),
        roleSought: "finance",
      }),
    ]);
  });
});
