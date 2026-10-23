import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import common from "../../../../../../../packages/i18n/messages/no/common.json";
import projectDetail from "../../../../../../../packages/i18n/messages/no/projectDetail.json";

const NOT_FOUND = "NEXT_NOT_FOUND";
const getLargeEventBySlug = vi.hoisted(() => vi.fn());
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedDepartmentTheme = vi.hoisted(() => vi.fn());
const renderPublishedEditorPage = vi.hoisted(() =>
  vi.fn(async () => "EDITOR_PAGE")
);

// The real translator over the real bundle: what `t.raw()` returns for a
// missing key is the behaviour under test, so it must not be a mock's guess.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "common.navigation" | "projectDetail") =>
    createTranslator({
      locale: "no",
      messages: { common, projectDetail },
      namespace,
      onError: () => undefined,
    }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentTheme,
  cachedPageEventsFeed: vi.fn(async () => []),
  cachedPublishedPage,
}));
vi.mock("@/lib/data/units", () => ({
  cachedPublicUnits: vi.fn(async () => []),
}));
vi.mock("@/lib/published-editor-page", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  renderPublishedEditorPage,
}));
vi.mock("@/app/actions/large-events", () => ({ getLargeEventBySlug }));
vi.mock("@/app/actions/campus", () => ({
  getCampusMetadata: vi.fn(async () => ({})),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
// The merged page renders the redesign's `PageHeader` (a plain component,
// rendered by nobody here); the body is the only part stubbed.
vi.mock("@/components/projects/project-detail-body", () => ({
  ProjectDetailBody: () => null,
}));

import ProjectDetailPage, { generateMetadata } from "./page";

const render = (slug: string) =>
  ProjectDetailPage({ params: Promise.resolve({ slug }) });

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    getLargeEventBySlug.mockReset();
    getLargeEventBySlug.mockResolvedValue(null);
    cachedPublishedPage.mockReset();
    cachedPublishedPage.mockResolvedValue(null);
    cachedDepartmentTheme.mockReset();
    renderPublishedEditorPage.mockClear();
  });

  it("is a 404 for a project with neither a row nor fallback copy", async () => {
    // Inspire was retired: no `large_event` row and no `projectDetail` entry.
    // Its old URL must not render an empty page titled "inspire".
    await expect(render("inspire")).rejects.toThrow(NOT_FOUND);
  });

  it("still renders a project that only has fallback copy", async () => {
    await expect(render("karrieredagene")).resolves.toBeDefined();
  });

  describe("editor page", () => {
    const page = {
      doc: { meta: {}, sections: [], version: 2 },
      row: { department_id: "d-nat" },
      translation: {
        description: "Stored description",
        is_published: true,
        title: "Winter Games",
      },
    };

    it("renders the published page through the shared pipeline", async () => {
      cachedPublishedPage.mockResolvedValue(page);
      cachedDepartmentTheme.mockResolvedValue({
        theme_accent: "#c8a2f0",
        theme_dark: "#3b1c6b",
      });

      await expect(render("winter-games")).resolves.toBe("EDITOR_PAGE");

      expect(cachedPublishedPage).toHaveBeenCalledWith(
        "projects/winter-games",
        "no"
      );
      expect(renderPublishedEditorPage).toHaveBeenCalledWith({
        departmentTheme: { theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" },
        locale: "no",
        result: page,
        slug: "projects/winter-games",
      });
      expect(getLargeEventBySlug).not.toHaveBeenCalled();
    });

    it("an unbound hub page passes no department theme", async () => {
      cachedPublishedPage.mockResolvedValue({
        ...page,
        row: { department_id: null },
      });

      await render("fadderullan");

      expect(cachedDepartmentTheme).not.toHaveBeenCalled();
      expect(renderPublishedEditorPage).toHaveBeenCalledWith(
        expect.objectContaining({ departmentTheme: null })
      );
    });

    it("renders the coded hub when no page is published", async () => {
      cachedPublishedPage.mockResolvedValue(null);

      await expect(render("karrieredagene")).resolves.not.toBe("EDITOR_PAGE");
      expect(renderPublishedEditorPage).not.toHaveBeenCalled();
    });

    it("never reads a page for a slug that is not a project", async () => {
      cachedPublishedPage.mockResolvedValue(page);

      await expect(render("inspire")).rejects.toThrow(NOT_FOUND);
      expect(cachedPublishedPage).not.toHaveBeenCalled();
    });

    it("titles the metadata from the page", async () => {
      cachedPublishedPage.mockResolvedValue(page);

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "winter-games" }),
      });

      expect(metadata.title).toBe("Winter Games | BISO");
      expect(metadata.description).toBe("Stored description");
    });

    it("keeps today's metadata when no page exists", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "karrieredagene" }),
      });

      expect(metadata.title).not.toBe("Winter Games | BISO");
      expect(String(metadata.title)).toContain("| BISO");
    });
  });
});
