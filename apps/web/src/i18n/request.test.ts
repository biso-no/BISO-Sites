import { expect, test, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getRequestConfig: <T>(factory: T) => factory,
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: async () => "no",
}));
vi.mock("@repo/i18n/messages", () => ({
  loadMessages: async () => ({}),
}));

test("formats dates in Oslo time, not the server's or browser's zone", async () => {
  const { default: requestConfig } = await import("./request");
  const config = await (
    requestConfig as unknown as () => Promise<{ timeZone?: string }>
  )();
  expect(config.timeZone).toBe("Europe/Oslo");
});
