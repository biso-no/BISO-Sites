import { ExpensesStatus } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const messaging = vi.hoisted(() => ({
  createEmail: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  createFile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb, messaging, storage })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn(
    async (key: string) => key !== "expenses_ledger_posting"
  ),
}));

vi.mock("@/lib/expense-approval", () => ({
  createApprovalChain: vi.fn(async () => undefined),
}));

vi.mock("@/lib/pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

vi.mock("@repo/api/file", () => ({
  InputFile: {
    fromBuffer: vi.fn(() => ({ file: "pdf" })),
  },
}));

import { POST } from "./route";

function submitRequest(body: Record<string, unknown>) {
  return new Request("https://api.example/expenses/submit", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

describe("expense submit route", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminDb.createRow.mockReset();
    adminDb.getRow.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.updateRow.mockReset();
    messaging.createEmail.mockReset();
    storage.createFile.mockReset();

    account.get.mockResolvedValue({ $id: "submitter-1" });
    // The scope check resolves the claimed department to confirm it exists and
    // sits on the claimed campus (see `assertExpenseScope`).
    adminDb.getRow.mockResolvedValue({
      $id: "dept-1",
      campus_id: "1",
      active: true,
    });
    sessionDb.getRow
      .mockResolvedValueOnce({
        $id: "submitter-1",
        address: "Street 1",
        bank_account: "1234.56.78901",
        city: "Oslo",
        department_ids: ["dept-1"],
        email: "ada@example.com",
        name: "Ada Lovelace",
        phone: "12345678",
        zip: "0001",
      })
      .mockResolvedValueOnce({
        $id: "expense-1",
        $sequence: 42,
        bank_account: "1234.56.78901",
        campus: "1",
        campusRel: { name: "Oslo" },
        department: "dept-1",
        departmentRel: { Name: "Operations Unit" },
        description: "Travel",
        expenseAttachments: [],
        prepayment_amount: null,
        status: ExpensesStatus.DRAFT,
        total: 100,
        userId: "submitter-1",
      });
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
    storage.createFile.mockResolvedValue({ $id: "pdf-1" });
    messaging.createEmail.mockResolvedValue({});
    sessionDb.updateRow.mockResolvedValue({});
  });

  it("creates submitted expense rows through the admin client with submitter permissions", async () => {
    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(200);
    expect(sessionDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        status: ExpensesStatus.DRAFT,
        total: 100,
        userId: "submitter-1",
      }),
      ['read("user:submitter-1")', 'update("user:submitter-1")']
    );
  });

  // The approval chain resolves approvers from the campus/department on the
  // payload, so an unchecked value would let anyone drop a reimbursement into
  // another department's queue, addressed to that department's real approvers.
  it("rejects a department the submitter does not belong to", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "dept-other",
      campus_id: "1",
      active: true,
    });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-other",
        total: 100,
      })
    );

    expect(response.status).toBe(403);
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  it("rejects a department that sits on a different campus", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "dept-1",
      campus_id: "2",
      active: true,
    });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(400);
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  // department_ids is provisioned by IT and m365-sync writes `?? []`, so a real
  // volunteer can legitimately have none. Blocking those users would break
  // reimbursements, so the campus check still applies and the rest is logged.
  it("allows submission when the profile carries no departments", async () => {
    sessionDb.getRow.mockReset();
    sessionDb.getRow
      .mockResolvedValueOnce({
        $id: "submitter-1",
        bank_account: "1234.56.78901",
        department_ids: [],
        email: "ada@example.com",
        name: "Ada Lovelace",
      })
      .mockResolvedValueOnce({
        $id: "expense-1",
        $sequence: 42,
        bank_account: "1234.56.78901",
        campus: "1",
        campusRel: { name: "Oslo" },
        department: "dept-1",
        departmentRel: { Name: "Operations Unit" },
        description: "Travel",
        expenseAttachments: [],
        prepayment_amount: null,
        status: ExpensesStatus.DRAFT,
        total: 100,
        userId: "submitter-1",
      });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(200);
  });
});
