import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRow: vi.fn(),
  page: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@repo/connectors/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: async () => ({ db: { createRow: mocks.createRow } }),
}));
vi.mock("@/lib/data/public-content", () => ({
  cachedPublishedPage: mocks.page,
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

  it("answers 400 for a malformed body", async () => {
    expect((await post({ ...base, locale: "de" })).status).toBe(400);
    expect((await post({ ...base, blockId: 4 })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
  });
});
