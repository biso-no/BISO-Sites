import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { setReplayConsent } from "./replay-consent";

describe("setReplayConsent", () => {
  beforeEach(() => {
    cookieStore.set.mockReset();
  });

  it("sets the consent cookie with the shared options", async () => {
    await setReplayConsent("granted");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "biso_replay_consent",
      "v1:granted",
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
    await expect(
      setReplayConsent("maybe" as unknown as "granted")
    ).rejects.toThrow("Invalid consent choice");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
