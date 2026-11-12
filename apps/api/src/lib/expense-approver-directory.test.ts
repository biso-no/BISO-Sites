import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmDirectoryApprover,
  findDirectoryApprover,
  saveDirectoryApprover,
  touchDirectoryApprover,
} from "./expense-approver-directory";

const listRows = vi.fn();
const createRow = vi.fn();
const updateRow = vi.fn();
const db = { createRow, listRows, updateRow } as never;

const row = {
  key: "campus:1:controller",
  scope: "campus" as const,
  campusId: "1",
  role: "controller" as const,
  email: "controller.oslo@biso.no",
  source: "ai" as const,
};

beforeEach(() => {
  for (const fn of [listRows, createRow, updateRow]) {
    fn.mockReset();
  }
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("findDirectoryApprover", () => {
  it("finds an active row by key", async () => {
    listRows.mockResolvedValue({
      rows: [
        {
          $id: "r1",
          key: row.key,
          email: "controller.oslo@biso.no",
          aad_id: "aad",
          display_name: "Controller Oslo",
          source: "seed",
        },
      ],
    });
    expect(await findDirectoryApprover(db, row.key)).toEqual({
      key: row.key,
      email: "controller.oslo@biso.no",
      aadId: "aad",
      displayName: "Controller Oslo",
      source: "seed",
    });
  });

  it("returns null when there is no row", async () => {
    listRows.mockResolvedValue({ rows: [] });
    expect(await findDirectoryApprover(db, row.key)).toBeNull();
  });
});

describe("saveDirectoryApprover", () => {
  it("creates a row", async () => {
    createRow.mockResolvedValue({});
    await saveDirectoryApprover(db, row);
    expect(createRow).toHaveBeenCalledTimes(1);
    expect(createRow.mock.calls[0]?.[3]).toMatchObject({
      key: row.key,
      email: row.email,
      campus_id: "1",
      active: true,
    });
  });

  it("updates an ai row on a key conflict", async () => {
    createRow.mockRejectedValue({ code: 409 });
    listRows.mockResolvedValue({ rows: [{ $id: "r1", source: "ai" }] });
    await saveDirectoryApprover(db, row);
    expect(updateRow).toHaveBeenCalledTimes(1);
  });

  it.each([
    "admin",
    "confirmed",
  ])("does not overwrite a %s row", async (source) => {
    createRow.mockRejectedValue({ code: 409 });
    listRows.mockResolvedValue({ rows: [{ $id: "r1", source }] });
    await saveDirectoryApprover(db, row);
    expect(updateRow).not.toHaveBeenCalled();
  });
});

describe("confirmDirectoryApprover", () => {
  it("confirms only when the email matches", async () => {
    listRows.mockResolvedValue({
      rows: [{ $id: "r1", email: "Controller.Oslo@biso.no" }],
    });
    await confirmDirectoryApprover(db, row.key, "controller.oslo@biso.no");
    expect(updateRow).toHaveBeenCalledTimes(1);
    expect(updateRow.mock.calls[0]?.[3]).toMatchObject({ source: "confirmed" });

    updateRow.mockReset();
    await confirmDirectoryApprover(db, row.key, "someone.else@biso.no");
    expect(updateRow).not.toHaveBeenCalled();
  });
});

describe("never throws", () => {
  it("swallows database errors", async () => {
    listRows.mockRejectedValue(new Error("down"));
    createRow.mockRejectedValue(new Error("down"));
    updateRow.mockRejectedValue(new Error("down"));
    expect(await findDirectoryApprover(db, row.key)).toBeNull();
    await expect(saveDirectoryApprover(db, row)).resolves.toBeUndefined();
    await expect(touchDirectoryApprover(db, row.key)).resolves.toBeUndefined();
    await expect(
      confirmDirectoryApprover(db, row.key, row.email)
    ).resolves.toBeUndefined();
  });
});
