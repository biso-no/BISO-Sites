import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "./recent";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

let storage = memoryStorage();

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recent searches", () => {
  it("keeps newest first and de-duplicates case-insensitively", () => {
    rememberSearch("Winter");
    rememberSearch("winter");
    rememberSearch("Jobs");
    expect(readRecentSearches()).toEqual(["Jobs", "winter"]);
  });

  it("keeps at most five", () => {
    for (const q of ["a", "b", "c", "d", "e", "f"]) {
      rememberSearch(q);
    }
    expect(readRecentSearches()).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("ignores blank queries and clears", () => {
    rememberSearch("  ");
    expect(readRecentSearches()).toEqual([]);
    rememberSearch("x");
    clearRecentSearches();
    expect(readRecentSearches()).toEqual([]);
  });

  it("does not throw when storage throws", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRecentSearches()).toEqual([]);
    expect(() => rememberSearch("x")).not.toThrow();
    expect(() => clearRecentSearches()).not.toThrow();
  });

  it("returns an empty list for corrupt data", () => {
    storage.setItem("biso.search.recent", "{nope");
    expect(readRecentSearches()).toEqual([]);
  });
});
