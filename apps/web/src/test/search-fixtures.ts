import {
  emptyQuickResponse,
  type QuickSearchResponse,
  type SearchHit,
} from "@repo/shared/search/response";

/** 12 Feb 2027, 18:00 in Oslo, as the index stores it (Unix seconds). */
export const FEB_12_2027 = Date.UTC(2027, 1, 12, 17) / 1000;

/** A search hit with neutral defaults; `type` follows `group` unless given. */
export function searchHit(
  overrides: Partial<SearchHit> & Pick<SearchHit, "id" | "group">
): SearchHit {
  return {
    campus_id: "2",
    campus_name: "Bergen",
    category: null,
    cover_pattern: null,
    deadline: null,
    department: null,
    ends_at: null,
    image: null,
    in_stock: null,
    location: null,
    member_only: false,
    member_price: null,
    price: null,
    published_at: null,
    row_id: overrides.id,
    snippet: [],
    starts_at: null,
    text_locale: "en",
    title: [{ match: false, text: overrides.id }],
    type: overrides.group,
    url: `/${overrides.group}/${overrides.id}`,
    ...overrides,
  };
}

export const winterBest = searchHit({
  id: "event_games_en",
  group: "event",
  title: [
    { match: true, text: "Winter" },
    { match: false, text: " Games 2027" },
  ],
  starts_at: FEB_12_2027,
  location: "Hafjell",
  url: "/events/winter-games-2027",
});

/** A quick answer for "winter": 23 hits, a best match, the page group empty. */
export const winterResponse: QuickSearchResponse = {
  ...emptyQuickResponse("winter", "en"),
  best: winterBest,
  total: 23,
  counts: { event: 6, news: 5, job: 2, product: 4, page: 4, unit: 2 },
  groups: {
    event: [
      searchHit({
        id: "event_kickoff_en",
        group: "event",
        starts_at: FEB_12_2027,
      }),
      searchHit({ id: "event_info_en", group: "event" }),
    ],
    news: [
      searchHit({
        id: "news_tickets_en",
        group: "news",
        published_at: FEB_12_2027,
      }),
    ],
    job: [
      searchHit({ id: "job_lead_en", group: "job", deadline: FEB_12_2027 }),
      searchHit({ id: "job_photo_en", group: "job" }),
    ],
    product: [
      searchHit({
        id: "product_hoodie_en",
        group: "product",
        price: 449,
        member_price: 349,
        in_stock: false,
      }),
    ],
    page: [],
    unit: [searchHit({ id: "unit_ski_en", group: "unit" })],
  },
};
