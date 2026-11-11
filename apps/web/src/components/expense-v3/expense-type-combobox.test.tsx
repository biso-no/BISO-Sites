// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { text?: string }) =>
    values?.text ? `${key} ${values.text}` : key,
}));

import { ExpenseTypeCombobox } from "./expense-type-combobox";
import type { ExpenseTypeOption } from "./types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const opt = (slug: string, label: string, labelNo: string) => ({
  slug,
  label,
  labelNo,
  askOccasion: false,
});
const OPTIONS: ExpenseTypeOption[] = [
  opt("travel", "Travel", "Reise"),
  opt("travel-food", "Food while travelling", "Mat på reise"),
  opt("venue-rental", "Venue rental", "Leie av lokale"),
];

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
};

async function setup(
  options = OPTIONS,
  extra: Record<string, unknown> = {},
  open = true
) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  const calls: unknown[] = [];
  const root = createRoot(container);
  await act(() => {
    root.render(
      createElement(ExpenseTypeCombobox, {
        locale: "en",
        options,
        state: undefined,
        value: {},
        onChange: (next: unknown) => calls.push(next),
        ...extra,
      } as never)
    );
  });
  const trigger = container.querySelector("button") as HTMLButtonElement;
  if (open) {
    await act(() => {
      trigger.focus();
      trigger.click();
    });
    await flush();
  }
  return { trigger, calls };
}

async function type(text: string) {
  const input = document.querySelector("[cmdk-input]") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

async function press(key: string) {
  const target = (document.activeElement as HTMLElement) ?? document.body;
  await act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
  await flush();
}

describe("ExpenseTypeCombobox", () => {
  it("keeps own text on Enter when nothing matches", async () => {
    const { calls } = await setup();
    await type("taxi");
    await press("Enter");
    expect(calls).toEqual([{ costTypeText: "taxi" }]);
  });

  it("keeps own text on Enter for a partial match", async () => {
    const { calls } = await setup();
    await type("rental");
    await press("Enter");
    expect(calls).toEqual([{ costTypeText: "rental" }]);
  });

  it("picks the exact type on Enter even when it is listed second", async () => {
    const { calls } = await setup([OPTIONS[1], OPTIONS[0], OPTIONS[2]]);
    await type("travel");
    await press("Enter");
    expect(calls).toEqual([{ costType: "travel" }]);
  });

  it("picks a match on Enter after ArrowDown", async () => {
    const { calls } = await setup();
    await type("rental");
    await press("ArrowDown");
    await press("Enter");
    expect(calls).toEqual([{ costType: "venue-rental" }]);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { trigger } = await setup();
    await press("Escape");
    expect(document.querySelector("[cmdk-root]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("names the trigger with its label, the chosen type and the AI mark", async () => {
    const { trigger } = await setup(
      OPTIONS,
      { ariaLabel: "Expense type", value: { costType: "travel" }, state: "ai" },
      false
    );
    expect(trigger.textContent).toContain("Expense type");
    expect(trigger.textContent).toContain("Travel");
    expect(trigger.textContent).toContain("aiPicked");
  });

  it("flags a missing choice", async () => {
    const { trigger } = await setup(OPTIONS, { state: "needs_choice" }, false);
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(trigger.textContent).toContain("choose");
  });
});
