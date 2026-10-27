import { beforeEach, describe, expect, it, vi } from "vitest";

const renderPublishedEditorPage = vi.hoisted(() =>
  vi.fn(async () => "RENDERED")
);
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedDepartmentTheme = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("@/lib/cookie-prefs", () => ({ SESSION_COOKIE: "session" }));
vi.mock("@repo/api/page-builder", () => ({ getPage: vi.fn() }));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentTheme,
  cachedPublishedPage,
  isPublishedPage: () => true,
}));
vi.mock("@/lib/published-editor-page", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  renderPublishedEditorPage,
}));

import DynamicPage from "./page";

describe("block page route: shared pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands the found page to renderPublishedEditorPage", async () => {
    const result = {
      doc: { meta: {}, sections: [], version: 2 },
      row: { department_id: "d-1" },
      translation: { is_published: true, title: "T" },
    };
    cachedPublishedPage.mockResolvedValue(result);
    cachedDepartmentTheme.mockResolvedValue({
      theme_accent: "#c8a2f0",
      theme_dark: "#3b1c6b",
    });

    await expect(
      DynamicPage({ params: Promise.resolve({ slug: ["om", "oss"] }) })
    ).resolves.toBe("RENDERED");

    expect(renderPublishedEditorPage).toHaveBeenCalledWith({
      departmentTheme: { theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" },
      locale: "no",
      result,
      slug: "om/oss",
    });
  });
});
