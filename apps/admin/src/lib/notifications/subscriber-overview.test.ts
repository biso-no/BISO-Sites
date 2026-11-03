import { describe, expect, test } from "bun:test";
import {
  overviewChannels,
  type SubscriberOverviewGrid,
  subscriberOverviewGrid,
} from "./subscriber-overview";

function cells(
  grid: SubscriberOverviewGrid
): Record<string, (string | null)[]> {
  return Object.fromEntries(grid.rows.map((row) => [row.key, row.channels]));
}

describe("subscriberOverviewGrid", () => {
  test("global admins see every campus and all campuses for every topic", () => {
    const grid = subscriberOverviewGrid({
      managedCampusIds: [],
      roles: ["globaladmin"],
    });

    expect(grid.columns).toEqual(["1", "2", "3", "4", null]);
    expect(cells(grid)).toEqual({
      events: [
        "events_oslo",
        "events_bergen",
        "events_trondheim",
        "events_stavanger",
        "events_national",
      ],
      everyone: [
        "general_oslo",
        "general_bergen",
        "general_trondheim",
        "general_stavanger",
        "general",
      ],
      jobs: [
        "jobs_oslo",
        "jobs_bergen",
        "jobs_trondheim",
        "jobs_stavanger",
        "jobs_national",
      ],
      news: [
        "news_oslo",
        "news_bergen",
        "news_trondheim",
        "news_stavanger",
        "news_national",
      ],
      shop: [
        "shop_oslo",
        "shop_bergen",
        "shop_trondheim",
        "shop_stavanger",
        "shop_national",
      ],
    });
  });

  test(
    "campus admins see their campus and the everyone total, but not the " +
      "all-campuses count of a topic",
    () => {
      const grid = subscriberOverviewGrid({
        managedCampusIds: ["2"],
        roles: ["campusadmin"],
      });

      expect(grid.columns).toEqual(["2", null]);
      expect(cells(grid)).toEqual({
        events: ["events_bergen", null],
        everyone: ["general_bergen", "general"],
        jobs: ["jobs_bergen", null],
        news: ["news_bergen", null],
        shop: ["shop_bergen", null],
      });
    }
  );

  test("a campus admin of several campuses sees a column for each, in campus order", () => {
    const grid = subscriberOverviewGrid({
      managedCampusIds: ["4", "1"],
      roles: ["campusadmin"],
    });

    expect(grid.columns).toEqual(["1", "4", null]);
  });

  test("a managed National campus adds no column of its own", () => {
    const grid = subscriberOverviewGrid({
      managedCampusIds: ["5", "3"],
      roles: ["campusadmin"],
    });

    expect(grid.columns).toEqual(["3", null]);
  });

  test("anyone else sees nothing", () => {
    for (const roles of [[], ["department"], ["hr"], ["benefitseditor"]]) {
      expect(
        subscriberOverviewGrid({ managedCampusIds: ["1"], roles })
      ).toEqual({ columns: [], rows: [] });
    }
  });
});

describe("overviewChannels", () => {
  test("lists each visible channel once and skips hidden cells", () => {
    const grid = subscriberOverviewGrid({
      managedCampusIds: ["1"],
      roles: ["campusadmin"],
    });

    expect(overviewChannels(grid).sort()).toEqual([
      "events_oslo",
      "general",
      "general_oslo",
      "jobs_oslo",
      "news_oslo",
      "shop_oslo",
    ]);
  });
});
