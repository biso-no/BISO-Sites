import { MessagePriority } from "@repo/api";
import type { Announcements } from "@repo/api/types/appwrite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepLink,
  buildPushData,
  type DispatchClients,
  dispatchAnnouncement,
  groupUserIdsByLocale,
  localizedPushContent,
  pushPriorityFor,
} from "./push-dispatch";

function makeAnnouncement(
  overrides: Record<string, unknown> = {}
): Announcements {
  return {
    $id: "announcement-1",
    status: "sent",
    category: "general",
    audience_type: "topic",
    audience_value: "events",
    title_en: "Title",
    title_no: null,
    body_en: "<p>Body</p>",
    body_no: null,
    event_id: null,
    content_type: null,
    content_id: null,
    campus_id: "1",
    deep_link: null,
    data: null,
    push: true,
    ...overrides,
  } as unknown as Announcements;
}

const noop = (): void => undefined;

interface Row {
  $id: string;
  locale: string | null;
}

function makeClients(rows: Row[] = []) {
  const db = {
    createRow: vi.fn(async () => ({})),
    listRows: vi.fn(async (_d: string, _t: string, _q: string[]) => ({
      rows,
    })),
    updateRow: vi.fn(async () => ({})),
  };
  const messaging = { createPush: vi.fn(async () => ({})) };
  return {
    clients: { db, messaging } as unknown as DispatchClients,
    db,
    messaging,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("localizedPushContent", () => {
  it("uses each language for its own channel", () => {
    const c = localizedPushContent({
      title_en: "Party",
      title_no: "Fest",
      body_en: "<p>Fri</p>",
      body_no: "<p>Fre</p>",
    });
    expect(c.no).toEqual({ title: "Fest", body: "Fre" });
    expect(c.en).toEqual({ title: "Party", body: "Fri" });
  });
  it("falls back to the other language when one is missing", () => {
    const c = localizedPushContent({
      title_en: "Party",
      title_no: null,
      body_en: null,
      body_no: "<p>Fre</p>",
    });
    expect(c.no).toEqual({ title: "Party", body: "Fre" });
    expect(c.en).toEqual({ title: "Party", body: "Fre" });
  });
});

describe("buildDeepLink", () => {
  it("links the content type", () => {
    expect(
      buildDeepLink({
        $id: "a1",
        content_type: "news",
        content_id: "n1",
        event_id: null,
      } as never)
    ).toBe("biso://news?id=n1");
    expect(
      buildDeepLink({
        $id: "a1",
        content_type: "job",
        content_id: "j1",
        event_id: null,
      } as never)
    ).toBe("biso://job?id=j1");
    expect(
      buildDeepLink({
        $id: "a1",
        content_type: "event",
        content_id: "e1",
        event_id: null,
      } as never)
    ).toBe("biso://event?id=e1");
  });
  it("still links an old row that only has event_id", () => {
    expect(
      buildDeepLink({
        $id: "a1",
        content_type: null,
        content_id: null,
        event_id: "e9",
      })
    ).toBe("biso://event?id=e9");
  });
  it("falls back to the announcement", () => {
    expect(
      buildDeepLink({
        $id: "a1",
        content_type: null,
        content_id: null,
        event_id: null,
      })
    ).toBe("biso://announcement?id=a1");
  });
});

it("buildPushData has exactly the contract keys, all strings", () => {
  const data = buildPushData(
    makeAnnouncement({
      category: "event",
      content_type: "event",
      content_id: "e1",
    })
  );
  expect(Object.keys(data).sort()).toEqual([
    "announcement_id",
    "category",
    "content_id",
    "content_type",
    "deep_link",
    "type",
  ]);
  expect(data).toMatchObject({
    type: "announcement",
    content_type: "event",
    content_id: "e1",
    deep_link: "biso://event?id=e1",
  });
  expect(buildPushData(makeAnnouncement())).toMatchObject({
    content_type: "",
    content_id: "",
  });
});

it("pushPriorityFor: urgent is high, others normal", () => {
  expect(pushPriorityFor("urgent")).toBe(MessagePriority.High);
  expect(pushPriorityFor("event")).toBe(MessagePriority.Normal);
  expect(pushPriorityFor(null)).toBe(MessagePriority.Normal);
});

describe("groupUserIdsByLocale", () => {
  it("splits by stored language, unknown becomes English", async () => {
    const { clients, db } = makeClients([
      { $id: "u1", locale: "no" },
      { $id: "u2", locale: "en" },
      { $id: "u3", locale: null },
    ]);
    const grouped = await groupUserIdsByLocale(
      (clients as unknown as { db: never }).db,
      ["u1", "u2", "u3", "u4"]
    );
    expect(grouped).toEqual({ no: ["u1"], en: ["u2", "u3", "u4"] });
    expect(db.listRows).toHaveBeenCalledTimes(1);
  });

  it("groups 150 ids across pages", async () => {
    const { db } = makeClients();
    const ids = Array.from({ length: 150 }, (_, i) => `u${i}`);
    db.listRows.mockImplementation((_d, _t, queries) => {
      const raw = queries.find((q) => q.includes('"$id"')) ?? "";
      const values = (JSON.parse(raw).values as string[]) ?? [];
      return Promise.resolve({
        rows: values.map((id) => ({ $id: id, locale: "no" })),
      });
    });
    const grouped = await groupUserIdsByLocale(db as never, ids);
    expect(db.listRows).toHaveBeenCalledTimes(2);
    expect(grouped.no).toHaveLength(150);
    expect(new Set(grouped.no).size).toBe(150);
    expect(grouped.en).toEqual([]);
  });

  it("sends everyone English when the lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(noop);
    const { db } = makeClients();
    db.listRows.mockRejectedValue(new Error("boom"));
    const grouped = await groupUserIdsByLocale(db as never, ["u1", "u2"]);
    expect(grouped).toEqual({ no: [], en: ["u1", "u2"] });
  });
});

describe("dispatchAnnouncement", () => {
  it("pushes a topic audience once per language", async () => {
    const { clients, messaging } = makeClients();
    const result = await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "topic",
        audience_value: "events",
        campus_id: "2",
        title_en: "Party",
        title_no: "Fest",
      }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledTimes(2);
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({
        topics: ["events_bergen_no"],
        title: "Fest",
        priority: "normal",
      })
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({
        topics: ["events_bergen_en"],
        title: "Party",
      })
    );
    expect(result).toEqual({ recipients: 0, topic: "events_bergen" });
  });

  it("scopes Everyone to the campus", async () => {
    const { clients, messaging } = makeClients();
    const result = await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "broadcast",
        audience_value: null,
        campus_id: "1",
      }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ topics: ["general_oslo_no"] })
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ topics: ["general_oslo_en"] })
    );
    expect(result).toEqual({ recipients: 0 });
  });

  it("sends Everyone with no campus to everyone", async () => {
    const { clients, messaging } = makeClients();
    await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "broadcast",
        audience_value: null,
        campus_id: null,
      }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ topics: ["general_no"] })
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ topics: ["general_en"] })
    );
  });

  it("sends urgent with high priority", async () => {
    const { clients, messaging } = makeClients();
    await dispatchAnnouncement(
      makeAnnouncement({ category: "urgent" }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledTimes(2);
    for (const [params] of messaging.createPush.mock.calls as unknown[][]) {
      expect(params).toMatchObject({ priority: "high" });
    }
  });

  it("pushes people in their own language", async () => {
    const { clients, db, messaging } = makeClients([
      { $id: "u1", locale: "no" },
      { $id: "u2", locale: "en" },
      { $id: "u3", locale: null },
    ]);
    const result = await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "users",
        audience_value: '["u1","u2","u3"]',
        title_en: "Party",
        title_no: "Fest",
      }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ users: ["u1"], title: "Fest" })
    );
    expect(messaging.createPush).toHaveBeenCalledWith(
      expect.objectContaining({ users: ["u2", "u3"], title: "Party" })
    );
    expect(db.createRow).toHaveBeenCalledTimes(3);
    expect(result.recipients).toBe(3);
  });

  it("skips a language with no recipients", async () => {
    const { clients, messaging } = makeClients([
      { $id: "u1", locale: "en" },
      { $id: "u2", locale: "en" },
    ]);
    await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "users",
        audience_value: '["u1","u2"]',
      }),
      clients
    );
    expect(messaging.createPush).toHaveBeenCalledTimes(1);
  });

  it("still sends the other language when one push fails", async () => {
    vi.spyOn(console, "error").mockImplementation(noop);
    const { clients, messaging } = makeClients();
    messaging.createPush.mockRejectedValueOnce(new Error("boom"));
    await expect(
      dispatchAnnouncement(makeAnnouncement(), clients)
    ).resolves.toEqual({ recipients: 0, topic: "events_oslo" });
    expect(messaging.createPush).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when push is off", async () => {
    const { clients, db, messaging } = makeClients();
    await dispatchAnnouncement(makeAnnouncement({ push: false }), clients);
    expect(messaging.createPush).not.toHaveBeenCalled();
    expect(db.updateRow).toHaveBeenCalledTimes(1);
  });
});
