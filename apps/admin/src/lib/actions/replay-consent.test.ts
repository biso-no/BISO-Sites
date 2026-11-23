import { beforeEach, describe, expect, it, mock } from "bun:test";

const cookieStore = { set: mock() };

mock.module("next/headers", () => ({
  cookies: async () => cookieStore,
}));

describe("setReplayConsent", () => {
  beforeEach(() => {
    cookieStore.set.mockReset();
  });

  it("sets the consent cookie with the shared options", async () => {
    const { setReplayConsent } = await import("./replay-consent");
    await setReplayConsent("denied");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "biso_replay_consent",
      "v1:denied",
      {
        path: "/",
        maxAge: 31_536_000,
        sameSite: "lax",
        secure: false,
        httpOnly: false,
        domain: undefined,
      }
    );
  });

  it("rejects anything but granted or denied", async () => {
    const { setReplayConsent } = await import("./replay-consent");
    await expect(
      setReplayConsent("maybe" as unknown as "granted")
    ).rejects.toThrow("Invalid consent choice");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
