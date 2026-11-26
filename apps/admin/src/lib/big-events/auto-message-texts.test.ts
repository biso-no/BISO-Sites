import { describe, expect, test } from "bun:test";
import { defaultAutoTexts } from "@repo/shared/big-events/messages/text";
import {
  AUTO_MESSAGE_KINDS,
  type AutoTextsForm,
  autoTextsForm,
  autoTextsPayload,
  isDefaultKind,
  resetKind,
} from "./auto-message-texts";

function defaults(): AutoTextsForm {
  return structuredClone(autoTextsForm(defaultAutoTexts));
}

function copy(form: AutoTextsForm): AutoTextsForm {
  return structuredClone(form);
}

describe("autoTextsPayload", () => {
  test("the defaults as they are save nothing of their own", () => {
    expect(autoTextsPayload(defaults(), defaults())).toBeNull();
  });

  test("only the fields that differ from the default are saved", () => {
    const texts = copy(defaults());
    texts.bus_moved.no.title = "  Du har fått ny buss  ";
    texts.departure_reminder.en.body = "{bus} leaves {departure}.";
    expect(autoTextsPayload(texts, defaults())).toEqual({
      bus_moved: { no: { title: "Du har fått ny buss" } },
      departure_reminder: { en: { body: "{bus} leaves {departure}." } },
    });
  });

  test("a field left empty goes back to the default", () => {
    const texts = copy(defaults());
    texts.bus_none.en.body = "   ";
    expect(autoTextsPayload(texts, defaults())).toBeNull();
  });
});

describe("resetKind", () => {
  test("puts back the defaults of one kind only", () => {
    const texts = copy(defaults());
    texts.bus_assigned.en.title = "Mine";
    texts.bus_moved.no.body = "Min";
    const reset = resetKind(texts, defaults(), "bus_assigned");
    expect(reset.bus_assigned).toEqual(defaults().bus_assigned);
    expect(reset.bus_moved.no.body).toBe("Min");
    expect(isDefaultKind(reset, defaults(), "bus_assigned")).toBe(true);
    expect(isDefaultKind(reset, defaults(), "bus_moved")).toBe(false);
  });

  test("every automatic kind is listed", () => {
    expect([...AUTO_MESSAGE_KINDS]).toEqual([
      "bus_assigned",
      "bus_moved",
      "bus_none",
      "departure_reminder",
    ]);
  });
});
