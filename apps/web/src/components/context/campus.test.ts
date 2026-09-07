import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const provider = codeOnly(
  readFileSync(join(import.meta.dirname, "campus.tsx"), "utf8")
);
const shell = codeOnly(
  readFileSync(join(import.meta.dirname, "../layout/site-shell.tsx"), "utf8")
);
const readers = readFileSync(
  join(import.meta.dirname, "../../lib/data/public-content.ts"),
  "utf8"
);

describe("campus state (RD-015)", () => {
  it("takes the active campus from the server, not from the client", () => {
    // Three sources used to disagree. The provider defaulted to *the first
    // campus in the list* while the server, seeing no cookie, filtered
    // *nothing* — so the switcher could read "Oslo" above national content.
    expect(provider).toContain("initialCampusId: string | null");
    expect(shell).toContain("getActiveCampus()");
    expect(shell).toContain("initialCampusId={activeCampusId}");
  });

  it("no longer reads or writes localStorage", () => {
    expect(provider).not.toContain("localStorage");
    expect(provider).not.toContain("biso-active-campus");
  });

  it("no longer fetches the campus list on mount", () => {
    // That was a hydrate-then-fetch waterfall before the switcher could render
    // its own label. SiteShell already has the list.
    expect(provider).not.toContain("getCampuses");
    expect(provider).not.toContain("useEffect");
    expect(shell).toContain("cachedShellCampuses()");
  });

  it("follows the server when a refresh brings a new value", () => {
    // React's "adjust state when a prop changes" pattern. Without it the
    // switcher would hold its optimistic answer after router.refresh().
    expect(provider).toContain("if (initialCampusId !== lastFromServer)");
    expect(provider).toContain("setSelected(initialCampusId)");
  });

  it("restores the previous label if persisting fails", () => {
    // Better than a label describing content that was never fetched.
    expect(provider).toContain("setSelected(lastFromServer)");
  });

  it("catches inside the cache scope, not around it", () => {
    // A rejection thrown out of a `"use cache"` function aborts the static
    // export before any caller's catch runs — this failed the build twice
    // before the handler moved inside. `cachedNavFeatured` avoids it the same
    // way.
    const fn = readers.slice(
      readers.indexOf("export async function cachedShellCampuses")
    );
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain('"use cache"');
    expect(body).toContain("} catch {");
    expect(body).toContain("return [];");
  });
});
