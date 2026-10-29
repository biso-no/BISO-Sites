import { Query } from "@repo/api";
import { GraphUserService } from "@repo/connectors/azure/users";
import { describe, expect, it, vi } from "vitest";
import {
  backfillM365TeamSync,
  type M365TeamSyncDeps,
  microsoftIdentities,
  noUserHasTeamIds,
  teamSyncRecordStore,
} from "./m365-team-sync-backfill";

interface Fixture {
  groups: Record<string, string[] | Error>;
  identities: { providerUid: string; userId: string }[];
  records: Record<string, string[] | null | Error>;
}

function makeDeps(fixture: Fixture) {
  const writeRecord = vi.fn<M365TeamSyncDeps["writeRecord"]>(async () => {
    await Promise.resolve();
  });
  const deps: M365TeamSyncDeps = {
    async *listMicrosoftIdentities() {
      await Promise.resolve();
      yield* fixture.identities;
    },
    groupNamesFor: async (providerUid) => {
      await Promise.resolve();
      const groups = fixture.groups[providerUid];
      if (groups instanceof Error) {
        throw groups;
      }
      return groups ?? [];
    },
    readRecord: async (userId) => {
      await Promise.resolve();
      const record = fixture.records[userId];
      if (record instanceof Error) {
        throw record;
      }
      return record ?? null;
    },
    writeRecord,
  };
  return { deps, writeRecord };
}

const fixture = (): Fixture => ({
  identities: [
    { userId: "same", providerUid: "g-same" },
    { userId: "changed", providerUid: "g-changed" },
    { userId: "new", providerUid: "g-new" },
  ],
  groups: {
    "g-same": ["SG-App-Dept-Marketing", "SG-App-Campus-Oslo", "Other group"],
    "g-changed": ["SG-App-Campus-Oslo"],
    "g-new": ["SG-App-Campus-National", "SG-App-Dept-OperationsUnit"],
  },
  records: {
    same: ["sg-app-campus-oslo", "sg-app-dept-marketing"],
    changed: ["sg-app-campus-oslo", "sg-app-dept-oldteam"],
    new: null,
  },
});

describe("backfillM365TeamSync", () => {
  it("dry run reports changes and never writes", async () => {
    const { deps, writeRecord } = makeDeps(fixture());

    const report = await backfillM365TeamSync(deps, { apply: false });

    expect(writeRecord).not.toHaveBeenCalled();
    expect(report.scanned).toBe(3);
    expect(report.errors).toEqual([]);
    expect(report.changes).toEqual([
      {
        userId: "changed",
        before: ["sg-app-campus-oslo", "sg-app-dept-oldteam"],
        after: ["sg-app-campus-oslo"],
      },
      {
        userId: "new",
        before: null,
        after: ["sg-app-campus-national", "sg-app-dept-operationsunit"],
      },
    ]);
  });

  it("apply writes only users whose team ids differ", async () => {
    const { deps, writeRecord } = makeDeps(fixture());

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(writeRecord.mock.calls).toEqual([
      ["changed", ["sg-app-campus-oslo"]],
      ["new", ["sg-app-campus-national", "sg-app-dept-operationsunit"]],
    ]);
    expect(report.changes.map((c) => c.userId)).toEqual(["changed", "new"]);
  });

  it("keeps only synced groups, lowercased, sorted and unique", async () => {
    const { deps, writeRecord } = makeDeps({
      identities: [{ userId: "u", providerUid: "g" }],
      groups: {
        g: [
          "SG-App-Dept-Marketing",
          "SG-App-Campus-Oslo",
          "SG-App-Dept-Marketing",
          "SG-App-Role-Admin",
          "Everyone",
        ],
      },
      records: {},
    });

    await backfillM365TeamSync(deps, { apply: true });

    expect(writeRecord).toHaveBeenCalledWith("u", [
      "sg-app-campus-oslo",
      "sg-app-dept-marketing",
    ]);
  });

  it("writes nothing for a user with no record and no synced groups", async () => {
    const { deps, writeRecord } = makeDeps({
      identities: [
        { userId: "u", providerUid: "g" },
        { userId: "admin", providerUid: "g-admin" },
      ],
      groups: { g: ["Everyone"], "g-admin": ["SG-App-Campus-Oslo"] },
      records: { u: null, admin: ["sg-app-campus-oslo"] },
    });

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(writeRecord).not.toHaveBeenCalled();
    expect(report.changes).toEqual([]);
    expect(report.usersWithTeamIds).toBe(1);
    expect(report.writesHeld).toBe(false);
  });

  it("writes nothing when no scanned user maps to any team id", async () => {
    const { deps, writeRecord } = makeDeps({
      identities: [
        { userId: "a", providerUid: "g-a" },
        { userId: "b", providerUid: "g-b" },
      ],
      groups: { "g-a": [], "g-b": ["Everyone"] },
      records: { a: ["sg-app-campus-oslo"], b: null },
    });

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(writeRecord).not.toHaveBeenCalled();
    expect(report.scanned).toBe(2);
    expect(report.usersWithTeamIds).toBe(0);
    expect(report.writesHeld).toBe(true);
    expect(noUserHasTeamIds(report)).toBe(true);
    // Still listed, so the owner sees what would have been emptied.
    expect(report.changes).toEqual([
      { userId: "a", before: ["sg-app-campus-oslo"], after: [] },
    ]);
  });

  it("a dry run reports the same condition without holding anything", async () => {
    const { deps } = makeDeps({
      identities: [{ userId: "a", providerUid: "g-a" }],
      groups: { "g-a": [] },
      records: { a: ["sg-app-campus-oslo"] },
    });

    const report = await backfillM365TeamSync(deps, { apply: false });

    expect(noUserHasTeamIds(report)).toBe(true);
    expect(report.writesHeld).toBe(false);
  });

  it("a Graph failure skips that user and the next one is still written", async () => {
    const data = fixture();
    data.groups["g-changed"] = new Error("Graph said no");
    const { deps, writeRecord } = makeDeps(data);

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(report.errors).toEqual([
      { userId: "changed", message: "Graph said no" },
    ]);
    expect(writeRecord.mock.calls.map(([userId]) => userId)).toEqual(["new"]);
    expect(report.changes.map((c) => c.userId)).toEqual(["new"]);
  });

  it("a record read failure skips that user", async () => {
    const data = fixture();
    data.records.changed = new Error("read failed");
    const { deps, writeRecord } = makeDeps(data);

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(report.errors).toEqual([
      { userId: "changed", message: "read failed" },
    ]);
    expect(writeRecord.mock.calls.map(([userId]) => userId)).toEqual(["new"]);
  });

  it("a write failure is reported and the rest continue", async () => {
    const { deps, writeRecord } = makeDeps(fixture());
    writeRecord.mockImplementationOnce(async () => {
      await Promise.resolve();
      throw new Error("write failed");
    });

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(report.errors).toEqual([
      { userId: "changed", message: "write failed" },
    ]);
    expect(writeRecord).toHaveBeenCalledTimes(2);
    expect(report.changes.map((c) => c.userId)).toEqual(["new"]);
  });

  it("uses the first Microsoft identity of a user, like the sign-in sync", async () => {
    const { deps, writeRecord } = makeDeps({
      identities: [
        { userId: "u", providerUid: "g1" },
        { userId: "u", providerUid: "g2" },
      ],
      groups: { g1: ["SG-App-Campus-Oslo"], g2: ["SG-App-Campus-Bergen"] },
      records: {},
    });

    const report = await backfillM365TeamSync(deps, { apply: true });

    expect(report.scanned).toBe(1);
    expect(writeRecord.mock.calls).toEqual([["u", ["sg-app-campus-oslo"]]]);
  });
});

describe("noUserHasTeamIds", () => {
  it("is true only when users were scanned and none maps to a team id", () => {
    expect(noUserHasTeamIds({ scanned: 0, usersWithTeamIds: 0 })).toBe(false);
    expect(noUserHasTeamIds({ scanned: 3, usersWithTeamIds: 0 })).toBe(true);
    expect(noUserHasTeamIds({ scanned: 3, usersWithTeamIds: 1 })).toBe(false);
  });
});

describe("backfill with Graph group names it can't read", () => {
  const GROUP = "#microsoft.graph.group";

  /** A Graph client answering `transitiveMemberOf` per user from `pages`. */
  function graphService(pages: Record<string, unknown>): GraphUserService {
    const service = new GraphUserService("tenant", "client", "secret");
    Reflect.set(service, "client", {
      api: (path: string) => {
        const request = {
          get: async () => {
            await Promise.resolve();
            return pages[path];
          },
          select: () => request,
        };
        return request;
      },
    });
    return service;
  }

  it("skips a user whose groups come back unnamed and still writes the next", async () => {
    const graph = graphService({
      "/users/g-1/transitiveMemberOf": {
        value: [{ "@odata.type": GROUP, id: "group-1", displayName: null }],
      },
      "/users/g-2/transitiveMemberOf": {
        value: [
          {
            "@odata.type": GROUP,
            id: "group-2",
            displayName: "SG-App-Campus-Oslo",
          },
        ],
      },
    });
    const writeRecord = vi.fn(async () => {
      await Promise.resolve();
    });

    const report = await backfillM365TeamSync(
      {
        async *listMicrosoftIdentities() {
          await Promise.resolve();
          yield { userId: "u1", providerUid: "g-1" };
          yield { userId: "u2", providerUid: "g-2" };
        },
        groupNamesFor: (providerUid) =>
          graph.listTransitiveGroupNames(providerUid),
        readRecord: async () => {
          await Promise.resolve();
          return ["sg-app-campus-national"];
        },
        writeRecord,
      },
      { apply: true }
    );

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].userId).toBe("u1");
    expect(report.errors[0].message).toContain("GroupMember.Read.All");
    expect(writeRecord.mock.calls).toEqual([["u2", ["sg-app-campus-oslo"]]]);
  });
});

describe("microsoftIdentities", () => {
  const identity = (n: number) => ({
    $id: `id-${n}`,
    userId: `user-${n}`,
    providerUid: `graph-${n}`,
    provider: "microsoft",
  });

  it("pages through Microsoft identities with a cursor", async () => {
    const pageOne = Array.from({ length: 100 }, (_, n) => identity(n));
    const pageTwo = [identity(100), identity(101)];
    const listIdentities = vi
      .fn()
      .mockResolvedValueOnce({ identities: pageOne, total: 102 })
      .mockResolvedValueOnce({ identities: pageTwo, total: 102 });

    const seen: { providerUid: string; userId: string }[] = [];
    for await (const entry of microsoftIdentities({ listIdentities })) {
      seen.push(entry);
    }

    expect(seen).toHaveLength(102);
    expect(seen[101]).toEqual({ userId: "user-101", providerUid: "graph-101" });
    expect(listIdentities).toHaveBeenCalledTimes(2);
    expect(listIdentities.mock.calls[0][0].queries).toEqual([
      Query.equal("provider", "microsoft"),
      Query.limit(100),
    ]);
    expect(listIdentities.mock.calls[1][0].queries).toEqual([
      Query.equal("provider", "microsoft"),
      Query.limit(100),
      Query.cursorAfter("id-99"),
    ]);
  });

  it("skips identities of another provider or without a provider uid", async () => {
    const listIdentities = vi.fn().mockResolvedValueOnce({
      identities: [
        { ...identity(1), provider: "google" },
        { ...identity(2), providerUid: "" },
        identity(3),
      ],
      total: 3,
    });

    const seen: { providerUid: string; userId: string }[] = [];
    for await (const entry of microsoftIdentities({ listIdentities })) {
      seen.push(entry);
    }

    expect(seen).toEqual([{ userId: "user-3", providerUid: "graph-3" }]);
  });
});

describe("teamSyncRecordStore", () => {
  const notFound = Object.assign(new Error("Row not found"), { code: 404 });

  it("reads the record's team ids, or null when there is none", async () => {
    const getRow = vi
      .fn()
      .mockResolvedValueOnce({ $id: "u", team_ids: ["sg-app-campus-oslo"] })
      .mockRejectedValueOnce(notFound);
    const store = teamSyncRecordStore({ getRow, upsertRow: vi.fn() });

    await expect(store.readRecord("u")).resolves.toEqual([
      "sg-app-campus-oslo",
    ]);
    await expect(store.readRecord("v")).resolves.toBeNull();
    expect(getRow).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "m365_team_sync",
      rowId: "u",
    });
  });

  it("rethrows read failures other than not found", async () => {
    const outage = Object.assign(new Error("unavailable"), { code: 503 });
    const store = teamSyncRecordStore({
      getRow: vi.fn().mockRejectedValue(outage),
      upsertRow: vi.fn(),
    });

    await expect(store.readRecord("u")).rejects.toBe(outage);
  });

  it("writes a service-only row keyed by the user id", async () => {
    const upsertRow = vi.fn().mockResolvedValue({});
    const store = teamSyncRecordStore({ getRow: vi.fn(), upsertRow });

    await store.writeRecord("u", ["sg-app-campus-oslo"]);

    expect(upsertRow).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "m365_team_sync",
      rowId: "u",
      data: {
        team_ids: ["sg-app-campus-oslo"],
        synced_at: expect.any(String),
      },
      permissions: [],
    });
    const { synced_at } = upsertRow.mock.calls[0][0].data;
    expect(new Date(synced_at).toISOString()).toBe(synced_at);
  });
});
