import { describe, expect, it } from "bun:test";
import {
  createUploadToken,
  UPLOAD_TOKEN_TTL_MS,
  type UploadTokenClaims,
  verifyUploadToken,
} from "./upload-token";

const SECRET = "test-appwrite-api-key";
const NOW = 1_800_000_000_000;
const NAMES_THE_KEY = /APPWRITE_API_KEY/;
const CLAIMS: UploadTokenClaims = {
  bucketId: "media",
  fileId: "6a1f00000000000000aa",
  filename: "clip.mp4",
  mime: "video/mp4",
  total: 12 * 1024 * 1024,
  userId: "user-1",
};
const options = { now: NOW, secret: SECRET };

describe("upload tokens", () => {
  it("round-trips for the upload it was issued for", () => {
    const token = createUploadToken(CLAIMS, options);
    expect(verifyUploadToken(token, CLAIMS, options)).toBeTrue();
  });

  it("refuses a forged token", () => {
    const token = createUploadToken(CLAIMS, options);
    const [expiresAt] = token.split(".");
    const forged = `${expiresAt}.${"A".repeat(43)}`;
    expect(verifyUploadToken(forged, CLAIMS, options)).toBeFalse();
  });

  it("refuses a token signed with another secret", () => {
    const token = createUploadToken(CLAIMS, { ...options, secret: "other" });
    expect(verifyUploadToken(token, CLAIMS, options)).toBeFalse();
  });

  it("refuses a token reused for another file", () => {
    const token = createUploadToken(CLAIMS, options);
    expect(
      verifyUploadToken(
        token,
        { ...CLAIMS, fileId: "6a1f00000000000000bb" },
        options
      )
    ).toBeFalse();
  });

  it("refuses the token once any authorised term changes", () => {
    const token = createUploadToken(CLAIMS, options);
    const changes: Partial<UploadTokenClaims>[] = [
      { mime: "video/webm" },
      { total: CLAIMS.total + 1 },
      { bucketId: "content" },
      { filename: "clip.exe" },
      { userId: "user-2" },
    ];
    for (const change of changes) {
      expect(
        verifyUploadToken(token, { ...CLAIMS, ...change }, options)
      ).toBeFalse();
    }
  });

  it("refuses a token with a moved expiry", () => {
    const token = createUploadToken(CLAIMS, options);
    const [expiresAt, signature] = token.split(".");
    const moved = `${Number(expiresAt) + UPLOAD_TOKEN_TTL_MS}.${signature}`;
    expect(verifyUploadToken(moved, CLAIMS, options)).toBeFalse();
  });

  it("expires", () => {
    const token = createUploadToken(CLAIMS, options);
    expect(
      verifyUploadToken(token, CLAIMS, {
        ...options,
        now: NOW + UPLOAD_TOKEN_TTL_MS - 1,
      })
    ).toBeTrue();
    expect(
      verifyUploadToken(token, CLAIMS, {
        ...options,
        now: NOW + UPLOAD_TOKEN_TTL_MS,
      })
    ).toBeFalse();
  });

  it("refuses malformed tokens", () => {
    for (const token of [
      "",
      "abc",
      "1.2.3",
      "x.y",
      `${NOW}.`,
      `.${"A".repeat(43)}`,
    ]) {
      expect(verifyUploadToken(token, CLAIMS, options)).toBeFalse();
    }
  });

  it("will not sign without a secret", () => {
    expect(() => createUploadToken(CLAIMS, { now: NOW, secret: "" })).toThrow(
      NAMES_THE_KEY
    );
  });
});
