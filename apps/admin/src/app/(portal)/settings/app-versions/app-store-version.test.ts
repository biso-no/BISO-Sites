import { beforeEach, describe, expect, mock, test } from "bun:test";

// `./app-store-version` starts with `import "server-only"`, which throws
// outside a Next.js server build.
mock.module("server-only", () => ({}));

const fetchMock = mock();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const { fetchAppStoreVersion } = await import("./app-store-version");

describe("fetchAppStoreVersion", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("reads the live App Store version", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ results: [{ version: "2.2.4" }] })
    );
    expect(await fetchAppStoreVersion()).toBe("2.2.4");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://itunes.apple.com/lookup?bundleId=com.biso.no&country=no",
      expect.anything()
    );
  });

  test("hides the App Store version when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchAppStoreVersion()).toBeNull();
  });

  test("hides a malformed App Store version", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ results: [{ version: "2.2" }] })
    );
    expect(await fetchAppStoreVersion()).toBeNull();
  });
});
