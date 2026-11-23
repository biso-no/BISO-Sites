import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSessionClient: vi.fn(),
  setSentryUser: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: mocks.createSessionClient,
}));

vi.mock("@repo/observability/user", () => ({
  setSentryUser: mocks.setSentryUser,
}));

import { createAuthenticatedClient } from "./auth";

const base64Url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const requestWith = (authorization?: string) =>
  ({
    headers: new Headers(authorization ? { authorization } : {}),
  }) as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAuthenticatedClient", () => {
  it("tags the Sentry user with the userId claim of the JWT", () => {
    const jwt = `${base64Url({ alg: "HS256" })}.${base64Url({ userId: "user-1" })}.sig`;

    createAuthenticatedClient(requestWith(`Bearer ${jwt}`));

    expect(mocks.setSentryUser).toHaveBeenCalledWith("user-1");
    expect(mocks.createSessionClient).toHaveBeenCalledWith(jwt);
  });

  it("clears the Sentry user for cookie-session requests without a JWT", () => {
    createAuthenticatedClient(requestWith());

    expect(mocks.setSentryUser).toHaveBeenCalledWith(null);
    expect(mocks.createSessionClient).toHaveBeenCalledWith(undefined);
  });
});
