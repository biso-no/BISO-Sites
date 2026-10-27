import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { installReactDom, type TestElement } from "@/test/react-dom-harness";
import type { EventRsvpEntry } from "../../../../_actions/event-segments";
import { RsvpPanel, sortRsvpEntries } from "./rsvp-panel";

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});
afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
});
afterAll(() => installedDom.restore());

function entry(
  userId: string,
  status: EventRsvpEntry["status"],
  name: string | null
): EventRsvpEntry {
  return {
    email: name ? `${userId}@bi.no` : null,
    name,
    status,
    updatedAt: "2026-10-20T10:00:00.000Z",
    userId,
  };
}

const entries = [
  entry("a", "not_going", "Anna"),
  entry("b", "going", "Zoe"),
  entry("c", "maybe", "Ola"),
  entry("d", "going", "Åse"),
  entry("e", "going", null),
];

async function mount(list: EventRsvpEntry[]): Promise<TestElement> {
  const container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(createElement(RsvpPanel, { entries: list }));
  });
  return container;
}

describe("sortRsvpEntries", () => {
  test("sortRsvpEntries orders going, maybe, not going, then by name", () => {
    const sorted = sortRsvpEntries(entries).map((e) => e.userId);
    expect(sorted).toEqual(["b", "d", "e", "c", "a"]);
  });
});

describe("RsvpPanel", () => {
  test("RsvpPanel shows the counts line", async () => {
    const container = await mount([
      entry("a", "going", "A"),
      entry("b", "going", "B"),
      entry("c", "maybe", "C"),
      entry("d", "not_going", "D"),
    ]);
    expect(container.textContent).toContain("2 going · 1 maybe · 1 not going");
  });

  test("RsvpPanel shows the empty state", async () => {
    const container = await mount([]);
    expect(container.textContent).toContain("No one has answered yet.");
  });
});
