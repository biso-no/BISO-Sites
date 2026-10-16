import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getGoogleWalletAccessToken,
  resetGoogleWalletTokenCache,
  syncGoogleWalletPass,
} from "./google-wallet-api";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const CONFIG = {
  clientEmail: "wallet@x.iam.gserviceaccount.com",
  issuerId: "3388",
  privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
};
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const OBJECT = {
  classId: "3388.biso-membership",
  id: "3388.member-user-1",
  rotatingBarcode: { type: "QR_CODE" },
};

type Handler = (url: string, init: RequestInit) => Response;

const fetchMock =
  vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function json(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

function tokenResponse(): Response {
  return json(200, {
    access_token: "token-1",
    expires_in: 3600,
    token_type: "Bearer",
  });
}

function route(handler: Handler) {
  fetchMock.mockImplementation((url, init) =>
    Promise.resolve(url === TOKEN_URL ? tokenResponse() : handler(url, init))
  );
}

function calls() {
  return fetchMock.mock.calls
    .filter(([url]) => url !== TOKEN_URL)
    .map(([url, init]) => ({
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      method: init.method,
      url,
    }));
}

beforeEach(() => {
  resetGoogleWalletTokenCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getGoogleWalletAccessToken", () => {
  it("exchanges a signed service-account assertion for a token", async () => {
    fetchMock.mockResolvedValue(tokenResponse());
    const now = Date.parse("2026-09-17T10:00:00Z");
    expect(await getGoogleWalletAccessToken(CONFIG, now)).toBe("token-1");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(TOKEN_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );
    const [header, payload, signature] = (form.get("assertion") ?? "").split(
      "."
    );
    expect(
      JSON.parse(Buffer.from(header ?? "", "base64url").toString())
    ).toEqual({ alg: "RS256", typ: "JWT" });
    expect(
      JSON.parse(Buffer.from(payload ?? "", "base64url").toString())
    ).toEqual({
      aud: TOKEN_URL,
      exp: now / 1000 + 3600,
      iat: now / 1000,
      iss: CONFIG.clientEmail,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(
      verifier.verify(publicKey, Buffer.from(signature ?? "", "base64url"))
    ).toBe(true);
  });

  it("reuses the token until shortly before it expires", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(tokenResponse()));
    const now = Date.parse("2026-09-17T10:00:00Z");
    await getGoogleWalletAccessToken(CONFIG, now);
    await getGoogleWalletAccessToken(CONFIG, now + 3_000_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getGoogleWalletAccessToken(CONFIG, now + 3_550_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when Google refuses the token", async () => {
    fetchMock.mockResolvedValue(json(400, { error: "invalid_grant" }));
    await expect(getGoogleWalletAccessToken(CONFIG)).rejects.toThrow(
      "token request failed"
    );
  });
});

describe("syncGoogleWalletPass", () => {
  it("inserts the class and object when they do not exist", async () => {
    route((_url, init) => json(init.method === "GET" ? 404 : 200));
    await syncGoogleWalletPass(CONFIG, OBJECT);
    expect(calls()).toEqual([
      {
        body: undefined,
        method: "GET",
        url: `${API}/genericClass/3388.biso-membership`,
      },
      {
        body: { id: "3388.biso-membership" },
        method: "POST",
        url: `${API}/genericClass`,
      },
      {
        body: undefined,
        method: "GET",
        url: `${API}/genericObject/3388.member-user-1`,
      },
      { body: OBJECT, method: "POST", url: `${API}/genericObject` },
    ]);
    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer token-1" });
  });

  it("updates the class and object when they exist", async () => {
    route(() => json(200));
    await syncGoogleWalletPass(CONFIG, OBJECT);
    expect(calls().map(({ method, url }) => `${method} ${url}`)).toEqual([
      `GET ${API}/genericClass/3388.biso-membership`,
      `PUT ${API}/genericClass/3388.biso-membership`,
      `GET ${API}/genericObject/3388.member-user-1`,
      `PUT ${API}/genericObject/3388.member-user-1`,
    ]);
    expect(calls().at(-1)?.body).toEqual(OBJECT);
  });

  it("updates instead when a concurrent insert wins", async () => {
    route((url, init) => {
      if (url.includes("genericClass")) {
        return json(200);
      }
      if (init.method === "GET") {
        return json(404);
      }
      return json(init.method === "POST" ? 409 : 200);
    });
    await syncGoogleWalletPass(CONFIG, OBJECT);
    expect(calls().at(-1)).toMatchObject({
      method: "PUT",
      url: `${API}/genericObject/3388.member-user-1`,
    });
  });

  it("throws when Google rejects a write", async () => {
    route((_url, init) => json(init.method === "GET" ? 200 : 500));
    await expect(syncGoogleWalletPass(CONFIG, OBJECT)).rejects.toThrow(
      "genericClass update failed"
    );
  });

  it("throws when a lookup fails with anything but 404", async () => {
    route(() => json(403));
    await expect(syncGoogleWalletPass(CONFIG, OBJECT)).rejects.toThrow(
      "genericClass get failed"
    );
  });
});
