import { describe, expect, it, vi } from "vitest";
import { buildProjectHub, type HubUnit } from "./project-hub";

const unit = (
  id: string,
  campusId: string,
  slug: string,
  overrides: Partial<HubUnit> = {}
): HubUnit => ({
  campusId,
  campusLabel:
    { "1": "Oslo", "2": "Bergen", "5": "National" }[campusId] ?? null,
  graphName: `X ${slug}`,
  href: `/units/${campusId}/${slug}`,
  id,
  logoUrl: null,
  name: slug,
  slug,
  summary: null,
  ...overrides,
});

const event = (title: string) => ({
  date: "1. jan.",
  going: 0,
  title,
  where: "",
});

describe("buildProjectHub", () => {
  it("builds one card per campus team with its next events", async () => {
    const units = [
      unit("317", "2", "fadderullan"),
      unit("24", "1", "fadderullan", { summary: "Oslo's welcome week" }),
      unit("99", "1", "case-club"),
    ];
    const loadEvents = vi.fn(async (id: string) =>
      id === "24" ? [event("Kick-off"), event("Concert")] : []
    );

    const hub = await buildProjectHub(units, "fadderullan", loadEvents);

    expect(hub.map((team) => team.campusLabel)).toEqual(["Oslo", "Bergen"]);
    expect(hub[0]).toMatchObject({
      events: [
        { date: "1. jan.", title: "Kick-off", where: "" },
        { date: "1. jan.", title: "Concert", where: "" },
      ],
      unit: { href: "/units/1/fadderullan", summary: "Oslo's welcome week" },
    });
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expect(loadEvents).not.toHaveBeenCalledWith("99");
  });

  it("caps the events shown per card", async () => {
    const units = [unit("24", "1", "fadderullan")];
    const hub = await buildProjectHub(units, "fadderullan", async () => [
      event("a"),
      event("b"),
      event("c"),
      event("d"),
    ]);
    expect(hub[0]?.events).toHaveLength(3);
  });

  it("keeps the other cards when one feed fails", async () => {
    const units = [
      unit("24", "1", "fadderullan"),
      unit("317", "2", "fadderullan"),
    ];
    const hub = await buildProjectHub(units, "fadderullan", (id) =>
      id === "24"
        ? Promise.reject(new Error("appwrite blinked"))
        : Promise.resolve([event("Bergen kick-off")])
    );
    expect(hub.map((team) => team.events.length)).toEqual([0, 1]);
  });

  it("is empty when no unit runs the project", async () => {
    const loadEvents = vi.fn(async () => []);
    expect(await buildProjectHub([], "winter-games", loadEvents)).toEqual([]);
    expect(loadEvents).not.toHaveBeenCalled();
  });
});
