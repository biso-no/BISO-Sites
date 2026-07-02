import { Query } from "@repo/api";
import { describe, expect, it, vi } from "vitest";
import { listAllUserMemberships } from "./appwrite-memberships";

function membership(id: number) {
  return { $id: `m-${id}`, teamId: `team-${id}` };
}

describe("listAllUserMemberships", () => {
  it("returns a single page when the total fits", async () => {
    const rows = [membership(1), membership(2)];
    const listMemberships = vi
      .fn()
      .mockResolvedValue({ memberships: rows, total: 2 });

    const result = await listAllUserMemberships({ listMemberships }, "user-1");

    expect(result).toEqual(rows);
    expect(listMemberships).toHaveBeenCalledTimes(1);
    expect(listMemberships).toHaveBeenCalledWith({
      userId: "user-1",
      queries: [Query.limit(100), Query.offset(0)],
    });
  });

  it("paginates past the first page until the total is reached", async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => membership(i));
    const pageTwo = [membership(100), membership(101)];
    const listMemberships = vi
      .fn()
      .mockResolvedValueOnce({ memberships: pageOne, total: 102 })
      .mockResolvedValueOnce({ memberships: pageTwo, total: 102 });

    const result = await listAllUserMemberships({ listMemberships }, "user-1");

    expect(result).toHaveLength(102);
    expect(listMemberships).toHaveBeenCalledTimes(2);
    expect(listMemberships).toHaveBeenLastCalledWith({
      userId: "user-1",
      queries: [Query.limit(100), Query.offset(100)],
    });
  });

  it("stops on a short page even when total is overstated", async () => {
    const listMemberships = vi
      .fn()
      .mockResolvedValue({ memberships: [membership(1)], total: 9999 });

    const result = await listAllUserMemberships({ listMemberships }, "user-1");

    expect(result).toHaveLength(1);
    expect(listMemberships).toHaveBeenCalledTimes(1);
  });
});
