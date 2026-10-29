import { describe, expect, mock, test } from "bun:test";
import {
  authorisePublishRow,
  publishAssistantStatusContent,
} from "./assistant-status-publish";

function deps(missing: string[] = []) {
  const adminDb = {
    listRows: mock(() =>
      Promise.resolve({ rows: [{ $id: "tr-1", $permissions: [] }] })
    ),
    updateRow: mock(() => Promise.resolve({})),
  };
  const sessionDb = { updateRow: mock(() => Promise.resolve({})) };
  const publishPage = mock((_id: string, locale: string) =>
    Promise.resolve({ missingTranslation: missing.includes(locale) })
  );
  return {
    adminDb,
    publishPage,
    sessionDb,
    value: {
      getAdminDb: () => Promise.resolve(adminDb),
      publishPage,
      sessionDb,
    } as never,
  };
}

describe("publishAssistantStatusContent", () => {
  test("pages publish through publishPage, never a status write", async () => {
    const d = deps(["en"]);
    await publishAssistantStatusContent("pages", "pages", "p1", d.value);
    expect(d.publishPage).toHaveBeenCalledWith("p1", "no");
    expect(d.publishPage).toHaveBeenCalledWith("p1", "en");
    expect(d.sessionDb.updateRow).not.toHaveBeenCalled();
  });

  test("a page with nothing to publish is an error", async () => {
    const d = deps(["no", "en"]);
    await expect(
      publishAssistantStatusContent("pages", "pages", "p1", d.value)
    ).rejects.toThrow("no content");
  });

  test("a page with one empty locale is published and names the skipped one", async () => {
    const d = deps(["en"]);
    const result = await publishAssistantStatusContent(
      "pages",
      "pages",
      "p1",
      d.value
    );
    expect(result).toEqual({ published: ["no"], skipped: ["en"] });
  });

  test("a locale whose publish reports nothing to publish counts as skipped", async () => {
    const d = deps();
    d.publishPage.mockImplementation((_id: string, locale: string) =>
      locale === "en"
        ? Promise.reject(new Error("Nothing to publish for en"))
        : Promise.resolve({ missingTranslation: false })
    );
    const result = await publishAssistantStatusContent(
      "pages",
      "pages",
      "p1",
      d.value
    );
    expect(result).toEqual({ published: ["no"], skipped: ["en"] });
  });

  test("news restamps its translations after the status write", async () => {
    const d = deps();
    await publishAssistantStatusContent("news", "news", "n1", d.value);
    expect(d.sessionDb.updateRow).toHaveBeenCalledWith("app", "news", "n1", {
      status: "published",
    });
    expect(d.adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "tr-1",
      {},
      ['read("any")']
    );
  });

  test("jobs restamp with the staff reads", async () => {
    const d = deps();
    await publishAssistantStatusContent("jobs", "jobs", "j1", d.value);
    expect(d.adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "tr-1",
      {},
      [
        'read("any")',
        'read("team:sg-app-dept-operationsunit")',
        'read("team:sg-app-dept-hr")',
      ]
    );
  });

  test("documents have no translation rows to restamp", async () => {
    const d = deps();
    await publishAssistantStatusContent(
      "documents",
      "documents",
      "d1",
      d.value
    );
    expect(d.sessionDb.updateRow).toHaveBeenCalled();
    expect(d.adminDb.listRows).not.toHaveBeenCalled();
  });
});

describe("authorisePublishRow", () => {
  test("a draft page publishes without the session read, which would 404", async () => {
    const readRow = mock(() => Promise.reject(new Error("Row not found")));
    const assertAccess = mock(() => undefined);
    await authorisePublishRow("pages", { assertAccess, readRow });
    expect(readRow).not.toHaveBeenCalled();

    // The publish itself goes through publishPage, which checks access.
    const d = deps();
    const result = await publishAssistantStatusContent(
      "pages",
      "pages",
      "draft-page",
      d.value
    );
    expect(result).toEqual({ published: ["no", "en"], skipped: [] });
    expect(d.publishPage).toHaveBeenCalledWith("draft-page", "no");
  });

  test("other domains read the row and check campus access", async () => {
    const readRow = mock(() => Promise.resolve({ campus_id: "oslo" }));
    const assertAccess = mock(() => undefined);
    await authorisePublishRow("news", { assertAccess, readRow });
    expect(readRow).toHaveBeenCalledTimes(1);
    expect(assertAccess).toHaveBeenCalledWith("oslo");
  });

  test("a denied access check stops the publish", async () => {
    const readRow = mock(() => Promise.resolve({ campus_id: "oslo" }));
    const assertAccess = mock(() => {
      throw new Error("Forbidden");
    });
    await expect(
      authorisePublishRow("jobs", { assertAccess, readRow })
    ).rejects.toThrow("Forbidden");
  });
});
