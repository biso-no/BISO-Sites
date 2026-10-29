import { AppwriteException } from "node-appwrite";
import { describe, expect, it } from "vitest";
import {
  appwriteErrorStatus,
  isNotFound,
  orNullIfNotFound,
  orNullIfRowNotFound,
} from "./errors";

describe("orNullIfRowNotFound", () => {
  const notFound = (type: string) =>
    Object.assign(new AppwriteException("missing", 404), { type });

  it("maps a missing row to null, in both spellings", async () => {
    await expect(
      orNullIfRowNotFound(Promise.reject(notFound("row_not_found")))
    ).resolves.toBeNull();
    await expect(
      orNullIfRowNotFound(Promise.reject(notFound("document_not_found")))
    ).resolves.toBeNull();
  });

  it("rethrows a 404 for a missing table or database", async () => {
    for (const type of ["table_not_found", "database_not_found"]) {
      const error = notFound(type);
      await expect(orNullIfRowNotFound(Promise.reject(error))).rejects.toBe(
        error
      );
    }
  });

  it("rethrows a 404 with no type and other failures", async () => {
    const bare = { code: 404 };
    await expect(orNullIfRowNotFound(Promise.reject(bare))).rejects.toBe(bare);
    const outage = new AppwriteException("down", 503);
    await expect(orNullIfRowNotFound(Promise.reject(outage))).rejects.toBe(
      outage
    );
  });
});

describe("isNotFound", () => {
  it("is true only for a 404", () => {
    expect(isNotFound(new AppwriteException("missing", 404))).toBe(true);
    expect(isNotFound({ code: 404 })).toBe(true);
    expect(isNotFound(new AppwriteException("down", 503))).toBe(false);
    expect(isNotFound(new AppwriteException("nope", 401))).toBe(false);
    expect(isNotFound(new Error("boom"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("appwriteErrorStatus", () => {
  it("returns HTTP error codes and ignores everything else", () => {
    expect(appwriteErrorStatus(new AppwriteException("x", 409))).toBe(409);
    expect(appwriteErrorStatus(new AppwriteException("x", 0))).toBeUndefined();
    expect(appwriteErrorStatus(new Error("x"))).toBeUndefined();
    expect(appwriteErrorStatus({ code: "ENOTFOUND" })).toBeUndefined();
  });
});

describe("orNullIfNotFound", () => {
  it("resolves the value", async () => {
    await expect(orNullIfNotFound(Promise.resolve(1))).resolves.toBe(1);
  });

  it("maps a 404 to null", async () => {
    await expect(
      orNullIfNotFound(Promise.reject(new AppwriteException("missing", 404)))
    ).resolves.toBeNull();
  });

  it("rethrows other failures", async () => {
    const outage = new AppwriteException("down", 503);
    await expect(orNullIfNotFound(Promise.reject(outage))).rejects.toBe(outage);
  });
});
