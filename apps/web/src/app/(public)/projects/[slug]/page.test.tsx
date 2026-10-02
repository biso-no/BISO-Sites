import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import common from "../../../../../../../packages/i18n/messages/no/common.json";
import projectDetail from "../../../../../../../packages/i18n/messages/no/projectDetail.json";

const NOT_FOUND = "NEXT_NOT_FOUND";
const getLargeEventBySlug = vi.hoisted(() => vi.fn());

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
vi.mock("@/app/actions/large-events", () => ({ getLargeEventBySlug }));
vi.mock("@/app/actions/campus", () => ({
  getCampusMetadata: vi.fn(async () => ({})),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/components/about/about-hero", () => ({ AboutHero: () => null }));
vi.mock("@/components/projects/project-detail-body", () => ({
  ProjectDetailBody: () => null,
}));

import ProjectDetailPage from "./page";

const render = (slug: string) =>
  ProjectDetailPage({ params: Promise.resolve({ slug }) });

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    getLargeEventBySlug.mockReset();
    getLargeEventBySlug.mockResolvedValue(null);
  });

  it("is a 404 for a project with neither a row nor fallback copy", async () => {
    // Inspire was retired: no `large_event` row and no `projectDetail` entry.
    // Its old URL must not render an empty page titled "inspire".
    await expect(render("inspire")).rejects.toThrow(NOT_FOUND);
  });

  it("still renders a project that only has fallback copy", async () => {
    await expect(render("karrieredagene")).resolves.toBeDefined();
  });
});
