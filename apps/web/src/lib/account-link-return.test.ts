import { describe, expect, it } from "vitest";
import { readAccountLinkReturn } from "./account-link-return";

describe("readAccountLinkReturn", () => {
  it("recognises a completed link", () => {
    expect(readAccountLinkReturn(new URLSearchParams("linked=1"))).toEqual({
      error: null,
      isReturnLeg: true,
    });
  });

  it("recognises a refused link as a return leg with its error", () => {
    expect(
      readAccountLinkReturn(new URLSearchParams("link_error=already_linked"))
    ).toEqual({ error: "already_linked", isReturnLeg: true });
  });

  it("ignores ordinary visits and unknown errors", () => {
    expect(readAccountLinkReturn(new URLSearchParams(""))).toEqual({
      error: null,
      isReturnLeg: false,
    });
    expect(
      readAccountLinkReturn(new URLSearchParams("link_error=<script>"))
    ).toEqual({ error: null, isReturnLeg: false });
  });
});
