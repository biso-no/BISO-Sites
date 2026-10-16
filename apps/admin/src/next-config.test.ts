import { describe, expect, it } from "bun:test";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import config from "../next.config";

const CAMERA_ALLOWED = "camera=(self), microphone=(), geolocation=()";
const CAMERA_BLOCKED = "camera=(), microphone=(), geolocation=()";

// Mirrors Next's rule: every matching rule applies in order, and the last
// value set for a key wins.
async function permissionsPolicyFor(pathname: string) {
  const rules = (await config.headers?.()) ?? [];
  let value: string | undefined;
  for (const rule of rules) {
    const match = getPathMatch(rule.source, { strict: true })(pathname);
    if (!match) {
      continue;
    }
    for (const header of rule.headers) {
      if (header.key === "Permissions-Policy") {
        value = header.value;
      }
    }
  }
  return value;
}

describe("admin headers", () => {
  it("allows the camera on the members scanner page", async () => {
    expect(await permissionsPolicyFor("/members/scan")).toBe(CAMERA_ALLOWED);
  });

  it("allows the camera on guest scanner links", async () => {
    expect(await permissionsPolicyFor("/scan/abc")).toBe(CAMERA_ALLOWED);
  });

  it("keeps the camera blocked everywhere else", async () => {
    expect(await permissionsPolicyFor("/members")).toBe(CAMERA_BLOCKED);
    expect(await permissionsPolicyFor("/members/scan/links")).toBe(
      CAMERA_BLOCKED
    );
  });
});
