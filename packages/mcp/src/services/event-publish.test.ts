/**
 * Publishing an event that was configured to announce itself.
 *
 * `publishEvent` in `apps/admin` writes the status and then, when the row has
 * `notify_push`, calls `sendEventAnnouncement`. Outbound messaging is a
 * restricted operation in this package — it cannot send that announcement and
 * will not pretend to.
 *
 * Publishing anyway would be the worst of the three options: the event goes
 * public, the announcement its organiser configured is silently dropped, and
 * there is no second chance, because the status is already `published` and the
 * portal's own publish will not re-send it. So the write is refused, and the
 * refusal says where to go instead.
 */

import { describe, expect, test } from "bun:test";
import { DomainError } from "../runtime/errors";
import { createFakeBackend, GLOBAL_ADMIN } from "../testing/index";
import { createContentService } from "./content";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function eventRow(extra: Record<string, unknown>) {
  return {
    events: [
      {
        $id: "ev-1",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "fest",
        status: "draft",
        campus_id: "1",
        campus: { $id: "1" },
        department_id: "dept-a",
        department: { $id: "dept-a" },
        ...extra,
      },
    ],
    content_translations: [],
  };
}

function backendFor(extra: Record<string, unknown>) {
  return createFakeBackend({ tables: eventRow(extra), hasElevated: true });
}

describe("an event with a push announcement configured", () => {
  test("is refused rather than published without it", async () => {
    const backend = backendFor({ notify_push: true });
    const service = createContentService(backend, LINKS);

    await expect(
      service.setStatus(GLOBAL_ADMIN(), "events", "ev-1", "published", null)
    ).rejects.toThrow(DomainError);
  });

  test("and nothing is written when it is refused", async () => {
    const backend = backendFor({ notify_push: true });
    const service = createContentService(backend, LINKS);

    await service
      .setStatus(GLOBAL_ADMIN(), "events", "ev-1", "published", null)
      .catch(() => undefined);

    expect(
      backend.writes.filter((write) => write.table !== "audit_logs")
    ).toHaveLength(0);
  });

  test("the refusal names the admin app rather than just saying no", async () => {
    const backend = backendFor({ notify_push: true });
    const service = createContentService(backend, LINKS);

    const error = await service
      .setStatus(GLOBAL_ADMIN(), "events", "ev-1", "published", null)
      .then(() => null)
      .catch((caught: unknown) => caught as DomainError);

    expect(error?.code).toBe("not_supported");
    expect(error?.remedy).toContain("admin app");
  });

  test("unpublishing it is still allowed — only publishing sends anything", async () => {
    const backend = backendFor({ notify_push: true, status: "published" });
    const service = createContentService(backend, LINKS);

    await service.setStatus(GLOBAL_ADMIN(), "events", "ev-1", "draft", null);

    expect(
      backend.writes.some(
        (write) => write.table === "events" && write.id === "ev-1"
      )
    ).toBe(true);
  });
});

describe("an ordinary event still publishes", () => {
  test("with notify_push false", async () => {
    const backend = backendFor({ notify_push: false });
    const service = createContentService(backend, LINKS);

    await service.setStatus(
      GLOBAL_ADMIN(),
      "events",
      "ev-1",
      "published",
      null
    );

    expect(
      backend.writes.some(
        (write) => write.table === "events" && write.id === "ev-1"
      )
    ).toBe(true);
  });

  test("and with the column absent altogether", async () => {
    const backend = backendFor({});
    const service = createContentService(backend, LINKS);

    await service.setStatus(
      GLOBAL_ADMIN(),
      "events",
      "ev-1",
      "published",
      null
    );

    expect(
      backend.writes.some(
        (write) => write.table === "events" && write.id === "ev-1"
      )
    ).toBe(true);
  });
});
