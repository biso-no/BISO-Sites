import { describe, expect, it } from "vitest";
import { scrubText, scrubUrl } from "../scrub";
import { __scrubForTest } from "./reporter";

const CORPUS = [
  "Failed for ola.nordmann@biso.no today",
  "mailto%3Akari%40biso.no and x%2Bola%40biso.no",
  "body=Hello+my+name+is+kari@biso.no",
  "Konto 1234.56.78903 rejected",
  "Konto 1234 56 78903 rejected",
  "fnr 01019012345 and 010190 12345",
  "IBAN NO93 8601 1117 947 invalid",
  "DE89 3704 0044 0532 0130 00 and NO9386011117947",
  "secret=abc123 & access_token=xyz&code=1",
  "oauth_token_secret=topsecret in body",
  "https://biso.no/path?token=abc&email=ola@biso.no#frag",
  "GET https://biso.no/api/x?userId=5 failed",
  "https://biso.no/fs/approve/ABCDEF123",
  "https://biso.no/recruitment/book/tok_123?x=1",
  "https://biso.no/scan/qrtoken",
  "/shop/order/66a1b2c3d4 returned 500",
  "app/(scan)/scan/[token]/page.js",
  "/members/scan/access stays",
  "plain harmless text with numbers 12345",
  "",
  `${"a-".repeat(300)}@x`,
];

describe("reporter scrubber stays in sync with scrub.ts", () => {
  it.each(CORPUS)("scrubText: %s", (input) => {
    expect(__scrubForTest.scrubText(input)).toBe(scrubText(input));
  });
  it.each(CORPUS)("scrubUrl: %s", (input) => {
    expect(__scrubForTest.scrubUrl(input)).toBe(scrubUrl(input));
  });
});
