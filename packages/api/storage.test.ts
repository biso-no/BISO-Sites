import { expect, test } from "vitest";
import {
  MEDIA_BUCKET_ID,
  resolveStorageFileUrl,
  resolveStorageFileUrls,
} from "./storage";

const ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";

const viewUrl = (fileId: string) =>
  `${ENDPOINT}/storage/buckets/${MEDIA_BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`;

test("expands a bare Appwrite file ID into a media view URL", () => {
  expect(resolveStorageFileUrl("6a8564de0036f521c3a4")).toBe(
    viewUrl("6a8564de0036f521c3a4")
  );
});

test("leaves an already-resolved storage URL untouched", () => {
  const url = viewUrl("6a967e28000ad11a187c");

  expect(resolveStorageFileUrl(url)).toBe(url);
});

test("leaves non-Appwrite URLs and app-served paths untouched", () => {
  expect(resolveStorageFileUrl("https://biso.no/hero.png")).toBe(
    "https://biso.no/hero.png"
  );
  expect(resolveStorageFileUrl("/images/logo-home.png")).toBe(
    "/images/logo-home.png"
  );
  expect(resolveStorageFileUrl("data:image/png;base64,AAAA")).toBe(
    "data:image/png;base64,AAAA"
  );
});

test("returns null for empty and nullish values", () => {
  expect(resolveStorageFileUrl(null)).toBeNull();
  expect(resolveStorageFileUrl(undefined)).toBeNull();
  expect(resolveStorageFileUrl("")).toBeNull();
  expect(resolveStorageFileUrl("   ")).toBeNull();
});

test("honours an explicit bucket", () => {
  expect(resolveStorageFileUrl("abc123", "avatars")).toBe(
    `${ENDPOINT}/storage/buckets/avatars/files/abc123/view?project=${PROJECT}`
  );
});

test("resolves a mixed list and drops empty entries", () => {
  const url = "https://biso.no/hero.png";

  expect(
    resolveStorageFileUrls(["6a8564de0036f521c3a4", url, null, ""])
  ).toEqual([viewUrl("6a8564de0036f521c3a4"), url]);
  expect(resolveStorageFileUrls(null)).toEqual([]);
});
