import { describe, expect, it, mock } from "bun:test";
import { JobsStatus } from "@repo/api/types/appwrite";
import { publishDueJobs, resolveJobPublication } from "./job-publication";

const NOW = new Date("2026-09-14T10:00:00.000Z");
const FUTURE = "2026-09-20T08:00:00.000Z";

describe("resolveJobPublication", () => {
  const base = {
    currentStatus: JobsStatus.DRAFT,
    now: NOW,
    publicationMode: "scheduled",
    requestedStatus: JobsStatus.PUBLISHED,
    scheduledPublishAt: FUTURE,
  };

  it("keeps a scheduled vacancy as a draft armed for the publish time", () => {
    expect(resolveJobPublication(base)).toEqual({
      scheduledPublishAt: FUTURE,
      status: JobsStatus.DRAFT,
    });
  });

  it("publishes immediately in 'now' mode", () => {
    expect(resolveJobPublication({ ...base, publicationMode: "now" })).toEqual({
      scheduledPublishAt: null,
      status: JobsStatus.PUBLISHED,
    });
  });

  it("publishes immediately when the scheduled time has passed", () => {
    expect(
      resolveJobPublication({
        ...base,
        scheduledPublishAt: "2026-09-14T09:59:00.000Z",
      })
    ).toEqual({ scheduledPublishAt: null, status: JobsStatus.PUBLISHED });
  });

  it("never takes an already published vacancy offline", () => {
    expect(
      resolveJobPublication({ ...base, currentStatus: JobsStatus.PUBLISHED })
    ).toEqual({ scheduledPublishAt: null, status: JobsStatus.PUBLISHED });
  });

  it("disarms the schedule on draft saves", () => {
    expect(
      resolveJobPublication({ ...base, requestedStatus: JobsStatus.DRAFT })
    ).toEqual({ scheduledPublishAt: null, status: JobsStatus.DRAFT });
  });

  it("requires a time when scheduling", () => {
    expect(
      resolveJobPublication({ ...base, scheduledPublishAt: null }).error
    ).toContain("Choose a publish time");
  });
});

describe("publishDueJobs", () => {
  function fakeDb(jobs: { $id: string; metadata: string | null }[]) {
    const calls: [string, string, Record<string, unknown>, string[]][] = [];
    const db = {
      createRow: mock(() => Promise.resolve({ $id: "audit-1" })),
      getRow: mock((_db: string, _table: string, id: string) =>
        Promise.resolve({
          $id: id,
          // "job-cancelled" had its schedule removed after the list query.
          scheduled_publish_at:
            id === "job-cancelled" ? null : "2026-09-14T09:00:00.000Z",
          status: JobsStatus.DRAFT,
        })
      ),
      listRows: mock((_db: string, table: string) =>
        Promise.resolve(
          table === "jobs"
            ? { rows: jobs, total: jobs.length }
            : { rows: [{ $id: "tr-no" }, { $id: "tr-en" }], total: 2 }
        )
      ),
      updateRow: mock(
        (
          _db: string,
          table: string,
          id: string,
          data: Record<string, unknown>,
          permissions: string[]
        ) => {
          calls.push([table, id, data, permissions]);
          return id === "job-broken"
            ? Promise.reject(new Error("boom"))
            : Promise.resolve({ $id: id });
        }
      ),
    };
    return { calls, db };
  }

  it("opens translations before publishing the vacancy", async () => {
    const { calls, db } = fakeDb([
      { $id: "job-1", metadata: JSON.stringify({ audience: "public" }) },
    ]);

    const result = await publishDueJobs(db as never, NOW);

    expect(result).toEqual({ failed: 0, processed: 1, published: 1 });
    expect(calls.map(([table, id]) => `${table}:${id}`)).toEqual([
      "content_translations:tr-no",
      "content_translations:tr-en",
      "jobs:job-1",
    ]);
    const [, , jobData, jobPermissions] = calls.at(-1) ?? [];
    expect(jobData).toEqual({
      scheduled_publish_at: null,
      status: JobsStatus.PUBLISHED,
    });
    expect(jobPermissions).toContain('read("any")');
  });

  it("uses members-only read access for member vacancies", async () => {
    const { calls, db } = fakeDb([
      { $id: "job-1", metadata: JSON.stringify({ audience: "members" }) },
    ]);

    await publishDueJobs(db as never, NOW);

    const [, , , jobPermissions] = calls.at(-1) ?? [];
    expect(jobPermissions).not.toContain('read("any")');
    expect(
      jobPermissions?.some((permission) => permission.startsWith('read("team:'))
    ).toBeTrue();
  });

  it("skips a vacancy whose schedule was cancelled mid-run", async () => {
    const { calls, db } = fakeDb([{ $id: "job-cancelled", metadata: null }]);

    const result = await publishDueJobs(db as never, NOW);

    expect(result).toEqual({ failed: 0, processed: 1, published: 0 });
    expect(calls).toHaveLength(0);
  });

  it("records an audit event for each scheduled publish", async () => {
    const { db } = fakeDb([{ $id: "job-1", metadata: null }]);

    await publishDueJobs(db as never, NOW);

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "audit_logs",
      expect.any(String),
      expect.objectContaining({
        action: "recruitment.vacancy.scheduled_publish",
        resource_id: "job-1",
      })
    );
  });

  it("keeps going when one vacancy fails", async () => {
    const { db } = fakeDb([
      { $id: "job-broken", metadata: null },
      { $id: "job-2", metadata: null },
    ]);

    const result = await publishDueJobs(db as never, NOW);

    expect(result).toEqual({ failed: 1, processed: 2, published: 1 });
  });
});
