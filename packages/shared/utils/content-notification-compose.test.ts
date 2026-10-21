import { describe, expect, it } from "vitest";
import {
  composeAutoAnnouncement,
  type NotifyItem,
  toNotifyItem,
} from "./content-notification-compose";
import { formatOsloDate, formatOsloTime } from "./oslo-time";

const NOW = new Date("2026-10-20T10:00:00Z");
const SHORT_DATE = {
  weekday: "short",
  day: "numeric",
  month: "short",
} as const;
const DAY_MONTH_LONG = { day: "numeric", month: "long" } as const;

function item(overrides: Partial<NotifyItem> = {}): NotifyItem {
  return {
    type: "event",
    id: "e1",
    campusId: "2",
    channel: "events_bergen",
    titleEn: "Autumn party",
    titleNo: "Høstfest",
    summaryEn: null,
    summaryNo: null,
    descriptionEn: null,
    descriptionNo: null,
    date: "2026-10-24T18:00:00Z",
    location: "Kafé",
    image: "img1",
    ...overrides,
  };
}

describe("single item", () => {
  it("composes an event", () => {
    const out = composeAutoAnnouncement([item()], NOW);
    const time = formatOsloTime("2026-10-24T18:00:00Z");
    expect(out.title_no).toBe("Høstfest");
    expect(out.title_en).toBe("Autumn party");
    expect(out.body_no).toBe(
      `${formatOsloDate("2026-10-24T18:00:00Z", SHORT_DATE, "nb-NO")} · ${time} · Kafé`
    );
    expect(out.body_en).toBe(
      `${formatOsloDate("2026-10-24T18:00:00Z", SHORT_DATE, "en-GB")} · ${time} · Kafé`
    );
    expect(out.content_id).toBe("e1");
    expect(out.content_ids).toBeNull();
    expect(out.source).toBe("auto");
    expect(out.status).toBe("sent");
    expect(out.sent_at).toBe(NOW.toISOString());
    expect(out.deep_link).toBeNull();
    expect(out.category).toBe("event");
    expect(out.content_type).toBe("event");
  });

  it("omits location when missing", () => {
    const out = composeAutoAnnouncement([item({ location: null })], NOW);
    expect(
      out.body_en.endsWith(formatOsloTime("2026-10-24T18:00:00Z") ?? "")
    ).toBe(true);
  });

  it("falls back to the other language", () => {
    const out = composeAutoAnnouncement([item({ titleNo: null })], NOW);
    expect(out.title_no).toBe("Autumn party");
    expect(out.title_en).toBe("Autumn party");
  });

  it("uses plain text description cut to 140 chars for news", () => {
    const long = "a".repeat(300);
    const out = composeAutoAnnouncement(
      [
        item({
          type: "news",
          channel: "news_bergen",
          descriptionEn: `<p>${long}</p>`,
          descriptionNo: `<p>${long}</p>`,
          location: null,
        }),
      ],
      NOW
    );
    expect(out.body_en).toBe(`${"a".repeat(140)}…`);
  });

  it("prefers short description for news", () => {
    const out = composeAutoAnnouncement(
      [
        item({
          type: "news",
          summaryEn: "Short",
          summaryNo: "Kort",
          descriptionEn: "<p>Long</p>",
        }),
      ],
      NOW
    );
    expect(out.body_en).toBe("Short");
    expect(out.body_no).toBe("Kort");
  });

  it("composes a job with deadline", () => {
    const date = "2026-11-02T10:00:00Z";
    const out = composeAutoAnnouncement(
      [
        item({
          type: "job",
          titleEn: "Marketing",
          titleNo: "Marketing",
          date,
          location: null,
          image: null,
        }),
      ],
      NOW
    );
    expect(out.title_en).toBe("New position: Marketing");
    expect(out.title_no).toBe("Ny stilling: Marketing");
    expect(out.body_en).toBe(
      `Apply by ${formatOsloDate(date, DAY_MONTH_LONG, "en-GB")}`
    );
    expect(out.body_no).toBe("Søknadsfrist 2. november");
  });

  it("uses the short description for a job without deadline", () => {
    const out = composeAutoAnnouncement(
      [
        item({
          type: "job",
          date: null,
          summaryEn: "Join us",
          summaryNo: "Bli med",
        }),
      ],
      NOW
    );
    expect(out.body_en).toBe("Join us");
    expect(out.body_no).toBe("Bli med");
  });

  it("cuts titles to 200 and bodies to 500", () => {
    const out = composeAutoAnnouncement(
      [
        item({
          titleEn: "t".repeat(300),
          summaryEn: "s".repeat(600),
          type: "news",
        }),
      ],
      NOW
    );
    expect(out.title_en).toHaveLength(200);
    expect(out.body_en.length).toBeLessThanOrEqual(500);
  });
});

describe("grouped", () => {
  const four = [1, 2, 3, 4].map((n) =>
    item({
      id: `e${n}`,
      titleEn: `En ${n}`,
      titleNo: `No ${n}`,
      image: `img${n}`,
    })
  );

  it("groups events", () => {
    const out = composeAutoAnnouncement(four, NOW);
    expect(out.title_en).toBe("4 new events in Bergen");
    expect(out.title_no).toBe("4 nye arrangementer i Bergen");
    expect(out.body_en).toBe("En 1 · En 2 · En 3 …");
    expect(out.body_no).toBe("No 1 · No 2 · No 3 …");
    expect(out.content_ids).toEqual(["e1", "e2", "e3", "e4"]);
    expect(out.content_id).toBeNull();
    expect(out.image).toBe("img1");
    expect(out.audience_value).toBe("events_bergen");
    expect(out.audience_type).toBe("topic");
    expect(out.campus_id).toBe("2");
    const parsed = JSON.parse(out.items) as Record<string, unknown>[];
    expect(parsed).toHaveLength(4);
    expect(Object.keys(parsed[0] ?? {}).sort()).toEqual(
      [
        "campus_id",
        "date",
        "id",
        "image",
        "title_en",
        "title_no",
        "type",
      ].sort()
    );
  });

  it("omits the ellipsis for three or fewer", () => {
    const out = composeAutoAnnouncement(four.slice(0, 2), NOW);
    expect(out.body_en).toBe("En 1 · En 2");
  });

  it("groups national jobs", () => {
    const jobs = [1, 2].map((n) =>
      item({
        type: "job",
        id: `j${n}`,
        campusId: null,
        channel: "jobs_national",
      })
    );
    const out = composeAutoAnnouncement(jobs, NOW);
    expect(out.title_en).toBe("2 new positions from BISO");
    expect(out.title_no).toBe("2 nye stillinger fra BISO");
    expect(out.campus_id).toBeNull();
  });

  it("groups news", () => {
    const news = [1, 2].map((n) => item({ type: "news", id: `n${n}` }));
    const out = composeAutoAnnouncement(news, NOW);
    expect(out.title_en).toBe("2 new news stories in Bergen");
    expect(out.title_no).toBe("2 nye nyheter i Bergen");
  });
});

describe("toNotifyItem", () => {
  it("maps an event row and translations", () => {
    const out = toNotifyItem(
      "event",
      {
        $id: "e1",
        campus_id: "2",
        start_date: "2026-10-24T18:00:00Z",
        location: "Kafé",
        image: "img",
      },
      [
        { locale: "en", title: "A", short_description: "s", description: "d" },
        { locale: "no", title: "B" },
      ]
    );
    expect(out).toMatchObject({
      type: "event",
      id: "e1",
      campusId: "2",
      channel: "events_bergen",
      titleEn: "A",
      titleNo: "B",
      summaryEn: "s",
      descriptionEn: "d",
      summaryNo: null,
      date: "2026-10-24T18:00:00Z",
      location: "Kafé",
      image: "img",
    });
  });

  it("maps news and job rows", () => {
    const news = toNotifyItem(
      "news",
      {
        $id: "n",
        campus_id: null,
        $createdAt: "2026-10-01T00:00:00Z",
        image: "i",
      },
      []
    );
    expect(news.date).toBe("2026-10-01T00:00:00Z");
    expect(news.channel).toBe("news_national");
    const job = toNotifyItem(
      "job",
      {
        $id: "j",
        campus_id: "1",
        application_deadline: "2026-11-02T10:00:00Z",
      },
      []
    );
    expect(job.date).toBe("2026-11-02T10:00:00Z");
    expect(job.image).toBeNull();
    expect(job.location).toBeNull();
  });
});
