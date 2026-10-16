import { expect, mock, test } from "bun:test";

mock.module("next-intl/server", () => ({
  getRequestConfig: <T>(factory: T) => factory,
}));
mock.module("@/app/actions/locale", () => ({
  getLocale: async () => "no",
}));
mock.module("@repo/i18n/messages", () => ({
  loadMessages: async () => ({}),
}));

const { default: requestConfig } = await import("./request");

test("formats dates in Oslo time, not the server's UTC", async () => {
  const config = await (
    requestConfig as unknown as () => Promise<{ timeZone?: string }>
  )();
  expect(config.timeZone).toBe("Europe/Oslo");
});
