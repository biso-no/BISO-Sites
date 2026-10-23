import { describe, expect, test } from "bun:test";
import {
  isAppwriteId,
  isBisoRecipient,
  optionValueFromLabel,
  uniqueValue,
} from "./submit-rules";

describe("submit rules", () => {
  test("recipient is ASCII, one mailbox, exactly biso.no", () => {
    expect(isBisoRecipient("Post.Ola+x@BISO.no")).toBe(true);
    for (const bad of [
      "ola@biso.no ",
      "øla@biso.no",
      "a@biso.no,b@biso.no",
      "a@evilbiso.no",
      "a@biso.no.evil.com",
      "a@biso.no\n",
    ]) {
      expect(isBisoRecipient(bad)).toBe(false);
    }
  });

  test("team ids follow Appwrite's rule", () => {
    expect(isAppwriteId("sg-app-dept-operationsunit")).toBe(true);
    expect(isAppwriteId("-bad")).toBe(false);
    expect(isAppwriteId("x".repeat(37))).toBe(false);
    expect(isAppwriteId("a b")).toBe(false);
  });

  test("labels that differ only in non-ASCII letters get distinct values", () => {
    expect(optionValueFromLabel("Ål")).toBe("al");
    expect(optionValueFromLabel("Øl")).toBe("ol");
    expect(optionValueFromLabel("Bærekraft")).toBe("baerekraft");
    expect(optionValueFromLabel("Café Å")).toBe("cafe_a");
    expect(optionValueFromLabel("???")).toBe("option");
    expect(uniqueValue("al", ["al", "al-2"])).toBe("al-3");
  });
});
