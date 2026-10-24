import { beforeEach, describe, expect, it, vi } from "vitest";

const renderPublishedEditorPage = vi.hoisted(() =>
  vi.fn(async () => "RENDERED")
);
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const department = vi.hoisted(() => ({
  $id: "d-1",
  Name: "OSL Fadderullan",
  theme_accent: "#c8a2f0",
  theme_dark: "#3b1c6b",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("./resolve", () => ({
  resolveUnit: async () => ({
    canonical: "/units/oslo/fadderullan",
    department,
    kind: "department",
  }),
}));
vi.mock("@/lib/data/public-content", () => ({ cachedPublishedPage }));
vi.mock("@/lib/data/units", () => ({ cachedUnitDetail: vi.fn() }));
vi.mock("@/lib/published-editor-page", () => ({ renderPublishedEditorPage }));
vi.mock("./_components/unit-view", () => ({ UnitView: () => null }));
vi.mock("./_components/campus-chooser", () => ({ CampusChooser: () => null }));
vi.mock("./loading", () => ({ default: () => null }));

import UnitPage from "./page";

describe("unit route: shared pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands its own published page to renderPublishedEditorPage", async () => {
    const result = {
      doc: {
        meta: {},
        sections: [{ columns: [{ blocks: [], id: "c" }], id: "s" }],
        version: 2,
      },
      row: { department_id: "d-1" },
      translation: { is_published: true, title: "T" },
    };
    cachedPublishedPage.mockResolvedValue(result);

    await expect(
      UnitPage({
        params: Promise.resolve({ segments: ["oslo", "fadderullan"] }),
      })
    ).resolves.toBe("RENDERED");

    expect(renderPublishedEditorPage).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentTheme: { theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" },
        locale: "no",
        result,
        slug: "units/oslo/fadderullan",
      })
    );
  });
});
