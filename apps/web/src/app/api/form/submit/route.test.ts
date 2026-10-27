import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRow: vi.fn(),
  adminGetPage: vi.fn(),
  cookieGet: vi.fn(),
  department: vi.fn(),
  getPage: vi.fn(),
  page: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/connectors/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: async () => ({
    db: { createRow: mocks.createRow, marker: "admin" },
  }),
  createSessionClient: async () => ({ db: { marker: "session" } }),
}));
vi.mock("@repo/api/page-builder", () => ({
  getPage: (slug: string, locale: string, db?: { marker?: string }) =>
    db?.marker === "admin"
      ? mocks.adminGetPage(slug, locale)
      : mocks.getPage(slug, locale),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentBySlugAndCampus: mocks.department,
  cachedPublishedPage: mocks.page,
  isPublishedPage: (
    r: {
      row?: { status?: string };
      translation?: { is_published?: boolean };
    } | null
  ) => Boolean(r?.row?.status === "published" && r.translation?.is_published),
}));

import { POST } from "./route";

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: "f1",
    type: "multiStepForm",
    heading: "Kontakt",
    submitMode: "email",
    recipientEmail: "post@biso.no",
    topic: "contact",
    steps: [
      {
        title: "En",
        fields: [{ name: "name", label: "Navn <b>", fieldType: "text" }],
      },
    ],
    ...overrides,
  };
}

function publish(b: Record<string, unknown>, campus: string | null = "01") {
  mocks.page.mockResolvedValue({
    row: { $id: "page-1", campus_id: campus },
    translation: { is_published: true },
    doc: {
      version: 2,
      meta: {},
      sections: [{ id: "s", layout: {}, columns: [{ id: "c", blocks: [b] }] }],
    },
  });
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/form/submit", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
}

const base = {
  blockId: "f1",
  data: { name: "Ada" },
  locale: "no",
  slug: "kontakt",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/form/submit", () => {
  it("emails the block's recipient and ignores one in the body", async () => {
    publish(block());
    const res = await post({
      ...base,
      data: { name: "Ada", recipientEmail: "evil@example.com" },
      recipientEmail: "evil@example.com",
      mode: "email",
      topic: "phish",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    const sent = mocks.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("post@biso.no");
    expect(sent.html).toContain("Navn &lt;b&gt;");
    expect(sent.html).not.toContain("evil@example.com");
    expect(sent.html).not.toContain("phish");
  });

  it("returns 400 and sends nothing for a recipient outside biso.no", async () => {
    for (const recipientEmail of [
      "x@evil.com",
      "x@evilbiso.no",
      "x@biso.no.evil.com",
      "a@biso.no,b@evil.com",
      "a@biso.no\nbcc:b@evil.com",
    ]) {
      publish(block({ recipientEmail }));
      const res = await post(base);
      expect(res.status, recipientEmail).toBe(400);
      expect((await res.json()).success).toBe(false);
    }
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.createRow).not.toHaveBeenCalled();
  });

  it("logs a rejected recipient without the submitter's data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    publish(block({ recipientEmail: "x@evil.com" }));
    await post({ ...base, data: { name: "Secret Person" } });
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Secret Person");
  });

  it("stores a database submission with the block's team and the page's campus", async () => {
    publish(block({ submitMode: "database", accessTeamId: "team-a" }), "03");
    const res = await post({
      ...base,
      accessTeamId: "team-evil",
      campusId: "99",
    });
    expect(res.status).toBe(200);
    const [, table, , row, permissions] = mocks.createRow.mock.calls[0];
    expect(table).toBe("form_submissions");
    expect(row).toMatchObject({
      access_team_id: "team-a",
      campus_id: "03",
      page_id: "page-1",
      source: "multiStepForm",
      topic: "contact",
    });
    expect(JSON.parse(row.data_json)).toEqual({ name: "Ada" });
    const joined = permissions.join(" ");
    expect(joined).toContain("team-a");
    expect(joined).toContain("sg-app-dept-operationsunit");
    expect(joined).not.toContain("team-evil");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for a page that is not published", async () => {
    mocks.page.mockResolvedValue(null);
    expect((await post(base)).status).toBe(404);
  });

  it("answers 404 for a block that is not on the page", async () => {
    publish(block());
    expect((await post({ ...base, blockId: "other" })).status).toBe(404);
  });

  it("limits one source address to five submissions a minute", async () => {
    vi.stubEnv("RATE_LIMIT_CLIENT_IP_HEADER", "x-test-ip");
    publish(block());
    const send = () =>
      POST(
        new Request("http://localhost/api/form/submit", {
          body: JSON.stringify(base),
          headers: { "x-test-ip": "203.0.113.9" },
          method: "POST",
        })
      );
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await send()).status);
    }
    vi.unstubAllEnvs();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("answers 413 for a declared body over the cap without reading the page", async () => {
    publish(block());
    const res = await POST(
      new Request("http://localhost/api/form/submit", {
        body: JSON.stringify(base),
        headers: { "content-length": String(10 * 1024 * 1024) },
        method: "POST",
      })
    );
    expect(res.status).toBe(413);
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("answers 413 for a streamed body over the cap, whatever it declares", async () => {
    publish(block());
    const chunk = new TextEncoder().encode("x".repeat(8 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
        if (sent > 64) {
          controller.close();
        }
      },
    });
    const res = await POST(
      new Request("http://localhost/api/form/submit", {
        body: stream,
        duplex: "half",
        headers: { "content-length": "10" },
        method: "POST",
      } as RequestInit)
    );
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(10);
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("checks the shape of the body before reading the page", async () => {
    publish(block());
    const many = Object.fromEntries(
      Array.from({ length: 300 }, (_, i) => [`k${i}`, "v"])
    );
    for (const bad of [
      { ...base, data: many },
      { ...base, data: ["a"] },
      { ...base, data: "x" },
      { ...base, slug: "a b" },
      { ...base, slug: "a\nb" },
      { ...base, slug: "" },
      { ...base, slug: `${"a".repeat(129)}` },
      { ...base, slug: 4 },
    ]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("emails the labels of chosen options, not their values", async () => {
    publish(
      block({
        steps: [
          {
            title: "x",
            fields: [
              {
                name: "drink",
                label: "Drikke",
                fieldType: "radio",
                options: [{ label: "Øl", value: "ol" }],
              },
            ],
          },
        ],
      })
    );
    await post({ ...base, data: { drink: "ol" } });
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain("Øl");
    expect(mocks.sendEmail.mock.calls[0][0].html).not.toContain(">ol<");
  });

  it("drops a malformed access team and still stores the row", async () => {
    publish(block({ submitMode: "database", accessTeamId: "bad team!" }));
    const res = await post(base);
    expect(res.status).toBe(200);
    const [, , , row, permissions] = mocks.createRow.mock.calls[0];
    expect(row.access_team_id).toBeNull();
    expect(permissions.join(" ")).not.toContain("bad team");
  });

  describe("unit pages", () => {
    const unitSlug = "units/oslo/fadderullan";

    function publishUnit(departmentId: string | null) {
      mocks.department.mockResolvedValue({ $id: "d-1", slug: "fadderullan" });
      mocks.page.mockResolvedValue({
        row: { $id: "page-1", campus_id: "01", department_id: departmentId },
        translation: { is_published: true },
        doc: {
          version: 2,
          meta: {},
          sections: [
            { id: "s", layout: {}, columns: [{ id: "c", blocks: [block()] }] },
          ],
        },
      });
    }

    it("accepts a unit page that belongs to the department", async () => {
      publishUnit("d-1");
      expect((await post({ ...base, slug: unitSlug })).status).toBe(200);
    });

    it("refuses a page sitting at a unit slug for another or no department", async () => {
      for (const owner of ["d-2", null]) {
        publishUnit(owner);
        expect((await post({ ...base, slug: unitSlug })).status).toBe(404);
      }
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("refuses a unit slug that resolves to no department", async () => {
      publishUnit("d-1");
      mocks.department.mockResolvedValue(null);
      expect((await post({ ...base, slug: unitSlug })).status).toBe(404);
    });
  });

  it.each([
    "Om-BISO",
    "om_oss",
    "info.2026",
    "fadderuka-ø",
  ])("accepts the stored slug %s and passes it to the reader as is", async (slug) => {
    publish(block());
    expect((await post({ ...base, slug })).status).toBe(200);
    expect(mocks.page).toHaveBeenCalledWith(slug, "no");
  });

  it("answers 400 for a malformed body", async () => {
    expect((await post({ ...base, locale: "de" })).status).toBe(400);
    expect((await post({ ...base, blockId: 4 })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
  });
});

describe("POST /api/form/submit: project pages", () => {
  it("rejects a projects/ slug that is not a known project", async () => {
    publish(block());
    const res = await post({ ...base, slug: "projects/not-a-project" });
    expect(res.status).toBe(404);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  function publishProject(row: Record<string, unknown>) {
    mocks.department.mockResolvedValue({ $id: "d-nat" });
    mocks.page.mockResolvedValue({
      row: { $id: "page-1", campus_id: "5", ...row },
      translation: { is_published: true },
      doc: {
        version: 2,
        meta: {},
        sections: [
          { id: "s", layout: {}, columns: [{ id: "c", blocks: [block()] }] },
        ],
      },
    });
  }

  it("accepts the page of a known project", async () => {
    publishProject({ department_id: "d-nat", slug: "projects/winter-games" });
    mocks.sendEmail.mockResolvedValue(undefined);
    const res = await post({ ...base, slug: "projects/winter-games" });
    expect(res.status).toBe(200);
  });

  it("refuses a row at a project address with the wrong department", async () => {
    publishProject({ department_id: null, slug: "projects/winter-games" });
    expect(
      (await post({ ...base, slug: "projects/winter-games" })).status
    ).toBe(404);
    publishProject({ department_id: "d-nat", slug: "projécts/winter-games" });
    expect(
      (await post({ ...base, slug: "projects/winter-games" })).status
    ).toBe(404);
  });
});

describe("POST /api/form/submit on members-only pages", () => {
  function membersPage(
    status = "published",
    translated = true,
    visibility = "authenticated"
  ) {
    return {
      row: { $id: "page-m", campus_id: "01", status, visibility },
      translation: { is_published: translated },
      doc: {
        version: 2,
        meta: {},
        sections: [
          { id: "s", layout: {}, columns: [{ id: "c", blocks: [block()] }] },
        ],
      },
    };
  }

  beforeEach(() => {
    mocks.page.mockResolvedValue(null);
  });

  it("accepts a member (their session can read the row)", async () => {
    mocks.adminGetPage.mockResolvedValue(membersPage());
    mocks.cookieGet.mockReturnValue({ value: "s" });
    mocks.getPage.mockResolvedValue(membersPage());
    const res = await post(base);
    expect(res.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("refuses a visitor with no session without reading further", async () => {
    mocks.adminGetPage.mockResolvedValue(membersPage());
    mocks.cookieGet.mockReturnValue(undefined);
    const res = await post(base);
    expect(res.status).toBe(404);
    expect(mocks.getPage).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a signed-in non-member", async () => {
    mocks.adminGetPage.mockResolvedValue(membersPage());
    mocks.cookieGet.mockReturnValue({ value: "s" });
    mocks.getPage.mockResolvedValue(null);
    const res = await post(base);
    expect(res.status).toBe(404);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("404s a draft members-only page, even for a member", async () => {
    mocks.adminGetPage.mockResolvedValue(membersPage("draft"));
    mocks.cookieGet.mockReturnValue({ value: "s" });
    mocks.getPage.mockResolvedValue(membersPage("draft"));
    expect((await post(base)).status).toBe(404);
    mocks.adminGetPage.mockResolvedValue(membersPage("published", false));
    expect((await post(base)).status).toBe(404);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("404s when the public lookup missed a page that is not members-only", async () => {
    mocks.adminGetPage.mockResolvedValue(
      membersPage("published", true, "public")
    );
    mocks.cookieGet.mockReturnValue({ value: "s" });
    expect((await post(base)).status).toBe(404);
  });

  it("never reads a members-only unit or project slug with the admin client", async () => {
    mocks.adminGetPage.mockResolvedValue(membersPage());
    mocks.cookieGet.mockReturnValue({ value: "s" });
    mocks.getPage.mockResolvedValue(membersPage());
    for (const slug of [
      "units/national/wintergames",
      "projects/winter-games",
    ]) {
      expect((await post({ ...base, slug })).status).toBe(404);
    }
    expect(mocks.adminGetPage).not.toHaveBeenCalled();
  });

  it("leaves public pages alone: no admin read", async () => {
    publish(block());
    const res = await post(base);
    expect(res.status).toBe(200);
    expect(mocks.adminGetPage).not.toHaveBeenCalled();
  });
});
