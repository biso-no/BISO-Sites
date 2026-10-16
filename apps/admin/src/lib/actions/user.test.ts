import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * The `user` table's rows are read-only to their owner and its `create`
 * grant is gone, so this action is the whole of self-service profile editing
 * on admin.biso.no. Two things have to hold: identity columns
 * (`student_id`, `bi_*`, `roles`) never reach the row — a forged
 * `student_id` is trusted by the member discount and the membership API —
 * and the row that gets created is not writable by the account that asked
 * for it.
 */

const adminDb = {
  createRow: mock(),
  getRow: mock(),
  updateRow: mock(),
};

const sessionDb = {
  createRow: mock(),
  getRow: mock(),
  updateRow: mock(),
};

const account = {
  get: mock(),
  updateName: mock(),
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ account, db: sessionDb })),
}));

const { updateProfile } = await import("./user");

function notFound() {
  return Object.assign(new Error("row_not_found"), { code: 404 });
}

const FULL_PAYLOAD = {
  bank_account: "12345678903",
  bi_employee_id: "9001234",
  bi_linked_at: "2026-01-01T00:00:00.000Z",
  email: "someone.else@bi.no",
  name: "Ola Nordmann",
  phone: "+4790000000",
  roles: ["admin"],
  student_id: "s1715738",
} as never;

const SELF_SERVICE_ONLY = {
  bank_account: "12345678903",
  name: "Ola Nordmann",
  phone: "+4790000000",
};

describe("updateProfile", () => {
  beforeEach(() => {
    adminDb.createRow.mockReset();
    adminDb.getRow.mockReset();
    adminDb.updateRow.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.updateRow.mockReset();
    account.get.mockReset();
    account.updateName.mockReset();

    account.get.mockResolvedValue({ $id: "user-1" });
    account.updateName.mockResolvedValue({});
    adminDb.getRow.mockResolvedValue({ $id: "user-1" });
    adminDb.createRow.mockResolvedValue({ $id: "user-1" });
    adminDb.updateRow.mockResolvedValue({ $id: "user-1" });
  });

  test("drops identity columns from the payload before writing", async () => {
    await updateProfile(FULL_PAYLOAD);

    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      SELF_SERVICE_ONLY
    );
  });

  test("writes with the admin client, never the caller's session", async () => {
    await updateProfile(FULL_PAYLOAD);

    expect(sessionDb.updateRow).not.toHaveBeenCalled();
    expect(sessionDb.createRow).not.toHaveBeenCalled();
    expect(account.updateName).toHaveBeenCalledWith("Ola Nordmann");
  });

  test("creates a missing row read-only to its owner", async () => {
    adminDb.getRow.mockRejectedValue(notFound());

    await updateProfile(FULL_PAYLOAD);

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      SELF_SERVICE_ONLY,
      ['read("user:user-1")']
    );
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("creates nothing when the profile read fails for another reason", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("service unavailable"), { code: 503 })
    );

    const result = await updateProfile(FULL_PAYLOAD);

    expect(result).toBeNull();
    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
