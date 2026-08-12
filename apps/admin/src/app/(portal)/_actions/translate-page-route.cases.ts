import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";

const translatePageDocument = mock(
  async ({ document }: { document: unknown }) => document
);

const authContext = {
  departmentTeamIds: [] as string[],
  roles: ["globaladmin"] as string[],
};

mock.module("@/lib/api-auth", () => ({
  requireApiAuth: mock(async () => ({ ctx: authContext })),
}));
mock.module("@/lib/content-translation.server", () => ({
  contentLocaleSchema: z.enum(["no", "en"]),
}));
mock.module("@/lib/page-document-translation", () => ({
  translatePageDocument,
}));

const { POST } = await import("../../api/translate-page/route");

const pageData = {
  blocks: [],
  meta: {
    accentColor: "#001731",
    department: "department-1",
    description: "Beskrivelse",
    slug: "side",
    status: "draft",
    title: "Side",
  },
};

const request = (body: unknown): Request =>
  new Request("https://admin.example.com/api/translate-page", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

beforeEach(() => {
  authContext.roles = ["globaladmin"];
  authContext.departmentTeamIds = [];
  translatePageDocument.mockClear();
});

describe("page translation route", () => {
  test("rejects malformed locale and page payloads", async () => {
    const invalidLocale = await POST(
      request({ pageData, sourceLocale: "de", targetLocale: "en" })
    );
    const invalidDocument = await POST(
      request({ pageData: {}, sourceLocale: "no", targetLocale: "en" })
    );

    expect(invalidLocale.status).toBe(400);
    expect(invalidDocument.status).toBe(400);
    expect(translatePageDocument).not.toHaveBeenCalled();
  });

  test("requires page publishing access before invoking AI", async () => {
    authContext.roles = [];

    const response = await POST(
      request({ pageData, sourceLocale: "no", targetLocale: "en" })
    );

    expect(response.status).toBe(403);
    expect(translatePageDocument).not.toHaveBeenCalled();
  });

  test("translates a valid authorized page request", async () => {
    const response = await POST(
      request({ pageData, sourceLocale: "no", targetLocale: "en" })
    );

    expect(response.status).toBe(200);
    expect(translatePageDocument).toHaveBeenCalledWith({
      document: pageData,
      sourceLocale: "no",
      targetLocale: "en",
    });
  });
});
