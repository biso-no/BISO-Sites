import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_ADMIN_URL,
  DEFAULT_SCREENSHOT_DIR,
  docsSdkEnv,
  readScreenshotConfig,
  resolveOutDir,
  screenshotFile,
} from "./config";

// Read the same way the guard does, so the test never hard-codes the id.
const PRODUCTION_PROJECT = (
  JSON.parse(
    readFileSync(
      join(import.meta.dir, "../../../../packages/api/appwrite.config.json"),
      "utf8"
    )
  ) as { projectId: string }
).projectId;

const DOCS_ENV = {
  DOCS_APPWRITE_API_KEY: "docs-test-key",
  DOCS_APPWRITE_ENDPOINT: "http://localhost:8080/v1",
  DOCS_APPWRITE_PROJECT: "docs-screenshots",
};

test("the production project id is readable", () => {
  expect(PRODUCTION_PROJECT.length).toBeGreaterThan(0);
});

test("throws when the docs project is missing", () => {
  expect(() =>
    readScreenshotConfig({ ...DOCS_ENV, DOCS_APPWRITE_PROJECT: undefined })
  ).toThrow("DOCS_APPWRITE_PROJECT");
  expect(() =>
    readScreenshotConfig({ ...DOCS_ENV, DOCS_APPWRITE_PROJECT: "  " })
  ).toThrow("DOCS_APPWRITE_PROJECT");
});

test("throws when the docs project is the production project", () => {
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      DOCS_APPWRITE_PROJECT: PRODUCTION_PROJECT,
    })
  ).toThrow("production");
});

test("throws for the production project in any case or with spaces", () => {
  for (const variant of [
    PRODUCTION_PROJECT.toUpperCase(),
    `${PRODUCTION_PROJECT.charAt(0).toUpperCase()}${PRODUCTION_PROJECT.slice(1)}`,
    `  ${PRODUCTION_PROJECT}  `,
    ` ${PRODUCTION_PROJECT.toUpperCase()}\t`,
  ]) {
    expect(() =>
      readScreenshotConfig({ ...DOCS_ENV, DOCS_APPWRITE_PROJECT: variant })
    ).toThrow("production");
  }
});

test("throws when an app project differs from the docs project only in case or spaces", () => {
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      NEXT_PUBLIC_APPWRITE_PROJECT: ` ${DOCS_ENV.DOCS_APPWRITE_PROJECT.toUpperCase()} `,
    })
  ).toThrow("NEXT_PUBLIC_APPWRITE_PROJECT");
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      APPWRITE_PROJECT_ID: DOCS_ENV.DOCS_APPWRITE_PROJECT.toUpperCase(),
    })
  ).toThrow("APPWRITE_PROJECT_ID");
});

test("throws when the docs project equals APPWRITE_PROJECT_ID", () => {
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      APPWRITE_PROJECT_ID: DOCS_ENV.DOCS_APPWRITE_PROJECT,
    })
  ).toThrow("APPWRITE_PROJECT_ID");
});

test("throws when the docs project equals NEXT_PUBLIC_APPWRITE_PROJECT", () => {
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      NEXT_PUBLIC_APPWRITE_PROJECT: DOCS_ENV.DOCS_APPWRITE_PROJECT,
    })
  ).toThrow("NEXT_PUBLIC_APPWRITE_PROJECT");
});

test("throws when the docs key is the app's own key", () => {
  expect(() =>
    readScreenshotConfig({
      ...DOCS_ENV,
      APPWRITE_API_KEY: DOCS_ENV.DOCS_APPWRITE_API_KEY,
    })
  ).toThrow("APPWRITE_API_KEY");
});

test("throws when the endpoint or the key is missing", () => {
  expect(() =>
    readScreenshotConfig({ ...DOCS_ENV, DOCS_APPWRITE_ENDPOINT: undefined })
  ).toThrow("DOCS_APPWRITE_ENDPOINT");
  expect(() =>
    readScreenshotConfig({ ...DOCS_ENV, DOCS_APPWRITE_API_KEY: "" })
  ).toThrow("DOCS_APPWRITE_API_KEY");
});

test("returns defaults for adminUrl and outDir", () => {
  expect(readScreenshotConfig(DOCS_ENV)).toEqual({
    adminUrl: DEFAULT_ADMIN_URL,
    apiKey: DOCS_ENV.DOCS_APPWRITE_API_KEY,
    endpoint: DOCS_ENV.DOCS_APPWRITE_ENDPOINT,
    outDir: DEFAULT_SCREENSHOT_DIR,
    projectId: DOCS_ENV.DOCS_APPWRITE_PROJECT,
  });
  expect(DEFAULT_ADMIN_URL).toBe("http://localhost:3001");
  expect(DEFAULT_SCREENSHOT_DIR).toBe("apps/docs/public/screenshots");
});

test("takes adminUrl and outDir from the env when set", () => {
  const config = readScreenshotConfig({
    ...DOCS_ENV,
    DOCS_ADMIN_URL: "http://127.0.0.1:4001",
    DOCS_SCREENSHOT_DIR: "tmp/shots",
  });
  expect(config.adminUrl).toBe("http://127.0.0.1:4001");
  expect(config.outDir).toBe("tmp/shots");
});

test("refuses an admin URL on the production domain", () => {
  for (const url of ["https://admin.biso.no", "https://biso.no"]) {
    expect(() =>
      readScreenshotConfig({ ...DOCS_ENV, DOCS_ADMIN_URL: url })
    ).toThrow("DOCS_ADMIN_URL");
  }
  expect(() =>
    readScreenshotConfig({ ...DOCS_ENV, DOCS_ADMIN_URL: "not a url" })
  ).toThrow("DOCS_ADMIN_URL");
});

test("a relative outDir is read from the repo root", () => {
  const config = readScreenshotConfig(DOCS_ENV);
  expect(resolveOutDir(config)).toBe(
    join(import.meta.dir, "../../../../apps/docs/public/screenshots")
  );
});

test("shots are saved inside outDir only", () => {
  const outDir = "/tmp/docs-shots";
  expect(screenshotFile(outDir, "recruitment-pipeline")).toBe(
    "/tmp/docs-shots/recruitment-pipeline.png"
  );
  expect(() => screenshotFile(outDir, "../escape")).toThrow("outside");
  expect(() => screenshotFile(outDir, "../../etc/passwd")).toThrow("outside");
});

test("the SDK env points every project, endpoint and key variable at the docs project", () => {
  const config = readScreenshotConfig(DOCS_ENV);
  expect(docsSdkEnv(config)).toEqual({
    APPWRITE_API_KEY: config.apiKey,
    APPWRITE_ENDPOINT: config.endpoint,
    APPWRITE_FUNCTION_API_KEY: undefined,
    APPWRITE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_APPWRITE_ENDPOINT: config.endpoint,
    NEXT_PUBLIC_APPWRITE_PROJECT: config.projectId,
  });
});
