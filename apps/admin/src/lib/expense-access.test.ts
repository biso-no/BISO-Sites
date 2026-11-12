import { describe, expect, test } from "bun:test";
import {
  canOpenExpensesSection,
  currentPendingStep,
  type ExpenseAccessExpense,
  type ExpenseAccessStep,
  type ExpenseViewer,
  expensePermissions,
  expenseVisibilityQueries,
} from "./expense-access";
import { NO_MATCH_FILTER } from "./utils/authorization";

const viewer = (over: Partial<ExpenseViewer> = {}): ExpenseViewer => ({
  accountEmail: null,
  controllerCampusIds: [],
  emails: [],
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusIds: [],
  name: null,
  userId: "viewer",
  ...over,
});

const expense = (
  over: Partial<ExpenseAccessExpense> = {}
): ExpenseAccessExpense => ({
  campus: "1",
  status: "pending",
  submitter_is_controller: false,
  submitter_is_financial_manager: false,
  userId: "submitter",
  ...over,
});

const step = (
  over: Partial<ExpenseAccessStep> & { step: number }
): ExpenseAccessStep => ({
  $id: `s${over.step}`,
  approver_email: "x@biso.no",
  approver_role: "manager",
  status: "pending",
  ...over,
});

const bossStep = step({ approver_email: "Boss@biso.no", step: 1 });
const financeStep = step({
  approver_email: "fin@biso.no",
  approver_role: "finance",
  step: 2,
});
const steps: ExpenseAccessStep[] = [bossStep, financeStep];

describe("currentPendingStep", () => {
  test("lowest pending step of a pending expense, else null", () => {
    expect(currentPendingStep("pending", [financeStep, bossStep])?.$id).toBe(
      "s1"
    );
    expect(currentPendingStep("approved", steps)).toBeNull();
    expect(
      currentPendingStep("pending", [{ ...bossStep, status: "approved" }])
    ).toBeNull();
  });
});

describe("expensePermissions", () => {
  test("global admin acts on behalf", () => {
    const p = expensePermissions(
      viewer({ isGlobalAdmin: true }),
      expense(),
      steps
    );
    expect(p).toMatchObject({
      canView: true,
      canDecide: true,
      decideAs: "on_behalf",
      canEdit: true,
      canEditBankAccount: true,
      canChangeApprover: true,
      currentStepId: "s1",
    });
  });

  test("controller on own campus acts; on another campus cannot view", () => {
    const here = expensePermissions(
      viewer({ controllerCampusIds: ["1"] }),
      expense(),
      steps
    );
    expect(here).toMatchObject({
      canView: true,
      canDecide: true,
      decideAs: "on_behalf",
    });
    const there = expensePermissions(
      viewer({ controllerCampusIds: ["2"] }),
      expense(),
      steps
    );
    expect(there.canView).toBe(false);
    expect(there.canDecide).toBe(false);
  });

  test("controller cannot act on a controller-submitted expense", () => {
    const p = expensePermissions(
      viewer({ controllerCampusIds: ["1"] }),
      expense({ submitter_is_controller: true }),
      steps
    );
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.decideAs).toBeNull();
  });

  test("campus admin is read-only", () => {
    const p = expensePermissions(
      viewer({ isCampusAdmin: true, managedCampusIds: ["1"] }),
      expense(),
      steps
    );
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.canRetryBooking).toBe(false);
  });

  test("current approver approves as approver", () => {
    const p = expensePermissions(
      viewer({ emails: ["boss@biso.no"] }),
      expense(),
      steps
    );
    expect(p).toMatchObject({
      canView: true,
      canDecide: true,
      decideAs: "approver",
      canEdit: true,
      canEditBankAccount: false,
      canChangeApprover: false,
    });
  });

  test("matches approver emails case-insensitively", () => {
    // The step stores "Boss@biso.no"; the viewer's emails are lowercased.
    expect(
      expensePermissions(viewer({ emails: ["boss@biso.no"] }), expense(), steps)
        .canDecide
    ).toBe(true);
  });

  test("a later step's approver can view but not decide", () => {
    const p = expensePermissions(
      viewer({ emails: ["fin@biso.no"] }),
      expense(),
      steps
    );
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
    expect(p.canEdit).toBe(false);
  });

  test("finance approver is closed on an FM-submitted expense", () => {
    const only = [
      step({
        approver_email: "fin@biso.no",
        approver_role: "finance",
        step: 1,
      }),
    ];
    const p = expensePermissions(
      viewer({ emails: ["fin@biso.no"] }),
      expense({ submitter_is_financial_manager: true }),
      only
    );
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
  });

  test("a global admin who submitted cannot act", () => {
    const p = expensePermissions(
      viewer({ isGlobalAdmin: true, userId: "submitter" }),
      expense(),
      steps
    );
    expect(p).toMatchObject({
      isSubmitter: true,
      canView: true,
      canDecide: false,
      canEdit: false,
      canEditBankAccount: false,
      canChangeApprover: false,
      canRetryBooking: false,
      decideAs: null,
    });
  });

  test("a submitter named as the current approver cannot act", () => {
    const p = expensePermissions(
      viewer({ emails: ["boss@biso.no"], userId: "submitter" }),
      expense(),
      steps
    );
    expect(p.isSubmitter).toBe(true);
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.canEditBankAccount).toBe(false);
    expect(p.canChangeApprover).toBe(false);
    expect(p.canRetryBooking).toBe(false);
    expect(p.decideAs).toBeNull();
  });

  test("a global admin who submitted a failed expense cannot edit or retry", () => {
    const p = expensePermissions(
      viewer({ isGlobalAdmin: true, userId: "submitter" }),
      expense({ status: "failed" }),
      steps
    );
    expect(p.canEdit).toBe(false);
    expect(p.canRetryBooking).toBe(false);
    expect(p.canEditBankAccount).toBe(false);
  });

  test("a controller step is closed to a controller-submitted expense", () => {
    const controllerStep = step({
      approver_email: "ctrl@biso.no",
      approver_role: "controller",
      step: 1,
    });
    const p = expensePermissions(
      viewer({ emails: ["ctrl@biso.no"] }),
      expense({ submitter_is_controller: true }),
      [controllerStep]
    );
    expect(p.canView).toBe(true);
    expect(p.canDecide).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.decideAs).toBeNull();
  });

  test("a campus admin cannot view another campus's expense", () => {
    const p = expensePermissions(
      viewer({ isCampusAdmin: true, managedCampusIds: ["2"] }),
      expense({ campus: "1" }),
      steps
    );
    expect(p.canView).toBe(false);
  });

  test("matches step emails stored with stray whitespace", () => {
    const padded = [step({ approver_email: " Boss@biso.no ", step: 1 })];
    expect(
      expensePermissions(
        viewer({ emails: ["boss@biso.no"] }),
        expense(),
        padded
      ).canDecide
    ).toBe(true);
  });

  test("failed expense: edit and retry for actors only", () => {
    const failed = expense({ status: "failed" });
    const actor = expensePermissions(
      viewer({ isGlobalAdmin: true }),
      failed,
      steps
    );
    expect(actor).toMatchObject({
      canEdit: true,
      canRetryBooking: true,
      canDecide: false,
    });
    const approver = expensePermissions(
      viewer({ emails: ["boss@biso.no"] }),
      failed,
      steps
    );
    expect(approver.canEdit).toBe(false);
    expect(approver.canRetryBooking).toBe(false);
  });

  test("approved and success: nothing editable", () => {
    for (const status of ["approved", "success"]) {
      const p = expensePermissions(
        viewer({ isGlobalAdmin: true }),
        expense({ status }),
        steps
      );
      expect(p.canEdit).toBe(false);
      expect(p.canDecide).toBe(false);
      expect(p.canRetryBooking).toBe(false);
    }
  });

  test("controller cannot change the approver of a controller step", () => {
    const controllerStep = [
      step({
        approver_email: "c@biso.no",
        approver_role: "controller",
        step: 1,
      }),
    ];
    const v = viewer({ controllerCampusIds: ["1"] });
    expect(
      expensePermissions(v, expense(), controllerStep).canChangeApprover
    ).toBe(false);
    expect(expensePermissions(v, expense(), steps).canChangeApprover).toBe(
      true
    );
  });
});

describe("canOpenExpensesSection", () => {
  test("admins, controllers and the approver role", () => {
    expect(canOpenExpensesSection(viewer({ isGlobalAdmin: true }), [])).toBe(
      true
    );
    expect(canOpenExpensesSection(viewer({ isCampusAdmin: true }), [])).toBe(
      true
    );
    expect(
      canOpenExpensesSection(viewer({ controllerCampusIds: ["1"] }), [])
    ).toBe(true);
    expect(canOpenExpensesSection(viewer(), ["expenseapprover"])).toBe(true);
    expect(canOpenExpensesSection(viewer(), ["hr"])).toBe(false);
  });
});

describe("expenseVisibilityQueries", () => {
  test("global admin sees everything", () => {
    expect(
      expenseVisibilityQueries(viewer({ isGlobalAdmin: true }), [])
    ).toEqual([]);
  });

  test("campus admin plus approver ids is an or of both", () => {
    const [q] = expenseVisibilityQueries(
      viewer({ isCampusAdmin: true, managedCampusIds: ["1"] }),
      ["e1"]
    );
    expect(q).toContain('"method":"or"');
    expect(q).toContain("campus");
    expect(q).toContain("e1");
  });

  test("managed campuses count only for campus admins; empty sides drop", () => {
    const [q] = expenseVisibilityQueries(
      viewer({ managedCampusIds: ["1"], controllerCampusIds: ["2"] }),
      []
    );
    expect(q).not.toContain('"method":"or"');
    expect(q).toContain('"2"');
    expect(q).not.toContain('"1"');
  });

  test("no grants matches nothing", () => {
    expect(expenseVisibilityQueries(viewer(), [])).toEqual([NO_MATCH_FILTER]);
  });
});
