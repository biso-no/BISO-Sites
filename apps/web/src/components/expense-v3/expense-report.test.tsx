// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("motion/react", () => ({
  motion: {
    // Drop motion's own props; keep the row's DOM props and handlers.
    tr: ({
      animate: _animate,
      initial: _initial,
      layout: _layout,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) =>
      createElement("tr", props),
  },
}));
vi.mock("@/lib/actions/expense", () => ({ uploadExpenseAttachment: vi.fn() }));
vi.mock("@/lib/actions/user", () => ({ updateProfile: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: {} }));

import { ExpenseReport, ReceiptRow } from "./expense-report";
import type { Receipt } from "./store";
import type { ExpenseTypeOption } from "./types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS: ExpenseTypeOption[] = [
  { slug: "travel", label: "Travel", labelNo: "Reise", askOccasion: false },
  { slug: "social", label: "Social", labelNo: "Sosialt", askOccasion: true },
];

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  amount: 249,
  confidence: 1,
  currency: "NOK",
  date: "2026-11-05",
  description: "Pizza",
  fileId: "f1",
  fileName: "pizza.jpg",
  fileType: "image/jpeg",
  fileUrl: "",
  id: "r1",
  progress: 100,
  status: "ready",
  typeState: "needs_choice",
  vendor: "Peppes Pizza",
  ...overrides,
});

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
};

async function renderRow(row: Receipt) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  const onSelect = vi.fn();
  const onUpdate = vi.fn();
  await act(() => {
    createRoot(container).render(
      createElement(
        "table",
        null,
        createElement(
          "tbody",
          null,
          createElement(ReceiptRow, {
            fileInputRef: { current: null },
            onSelect,
            onUpdate,
            receipt: row,
            selectedId: null,
            setUploadState: vi.fn(),
            typeOptions: OPTIONS,
            uploadState: null,
          })
        )
      )
    );
  });
  const triggers = [
    ...container.querySelectorAll<HTMLButtonElement>(
      'button[aria-haspopup="listbox"]'
    ),
  ];
  return { container, onSelect, onUpdate, triggers };
}

describe("ReceiptRow type cell", () => {
  it("shows a receipt without a type as needing a choice", async () => {
    const { triggers } = await renderRow(receipt());

    // One picker under the vendor, one in the wide-screen column.
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.getAttribute("aria-invalid")).toBe("true");
      expect(trigger.textContent).toContain("choose");
      expect(trigger.textContent).toContain(
        "composer.report.typeFor Peppes Pizza"
      );
    }
  });

  it("picks a type without opening the receipt", async () => {
    const { onSelect, onUpdate, triggers } = await renderRow(receipt());

    await act(() => {
      triggers[0].click();
    });
    await flush();
    expect(onSelect).not.toHaveBeenCalled();

    const option = [
      ...document.querySelectorAll<HTMLElement>("[cmdk-item]"),
    ].find((item) => item.textContent?.includes("Travel"));
    expect(option).toBeDefined();
    await act(() => {
      option?.click();
    });
    await flush();

    expect(onSelect).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith("r1", {
      costType: "travel",
      costTypeText: undefined,
      typeState: "chosen",
    });
  });

  it("still opens the receipt from the rest of the row", async () => {
    const { container, onSelect } = await renderRow(receipt());

    await act(() => {
      container.querySelector("td")?.click();
    });

    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  it("shows receipt-check and duplicate notices", async () => {
    const { container } = await renderRow(
      receipt({ possibleDuplicate: true, receiptIssues: ["not_a_receipt"] })
    );

    expect(container.textContent).toContain("not_a_receipt");
    expect(container.textContent).toContain("possible_duplicate");
  });

  it("asks for no type on a linked bank statement", async () => {
    const { triggers } = await renderRow(
      receipt({ amount: 0, parentId: "r0", typeState: undefined })
    );

    expect(triggers).toHaveLength(0);
  });
});

async function renderReport(
  receipts: Receipt[],
  extra: Record<string, unknown> = {}
) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn();
  const onOccasionChange = vi.fn();
  const baseProps = {
    campuses: [],
    description: "Food for the board",
    isGeneratingSummary: false,
    isSavingDraft: false,
    isSubmitting: false,
    occasion: "",
    occasionError: false,
    onAssign: vi.fn(),
    onDescriptionChange: vi.fn(),
    onInsert: vi.fn(),
    onOccasionChange,
    onProfileUpdate: vi.fn(),
    onSaveDraft: vi.fn(),
    onSelect: vi.fn(),
    onSubmit,
    onSubmitterIsFinancialManagerChange: vi.fn(),
    onUpdate: vi.fn(),
    receipts,
    selectedCampusId: "5",
    selectedDepartmentId: "dept-1",
    selectedId: null,
    submitterIsFinancialManager: false,
    totalAmount: 249,
    typeOptions: OPTIONS,
    userProfile: { bank_account: "12345678903", name: "Kari" },
  };
  const rerender = (overrides: Record<string, unknown>) =>
    act(() => {
      root.render(
        createElement(ExpenseReport, {
          ...baseProps,
          ...extra,
          ...overrides,
        } as never)
      );
    });
  await rerender({});
  const submit = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("composer.report.submit")
  ) as HTMLButtonElement;
  return { container, onOccasionChange, onSubmit, rerender, submit };
}

describe("ExpenseReport submit gating", () => {
  it("takes the student to the first receipt without a type instead of submitting", async () => {
    const scrolled: Element[] = [];
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(function (this: HTMLElement) {
        scrolled.push(this);
      });
    const { container, onSubmit, submit } = await renderReport([
      receipt({ costType: "travel", id: "r0", typeState: "chosen" }),
      receipt(),
    ]);

    expect(submit.disabled).toBe(false);
    expect(container.textContent).toContain("composer.report.submitHintTypes");
    const hintId = submit.getAttribute("aria-describedby");
    expect(hintId && document.getElementById(hintId)?.textContent).toContain(
      "composer.report.submitHintTypes"
    );

    await act(() => {
      submit.click();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(scrolled.map((element) => element.id)).toEqual([
      "expense-receipt-r1",
    ]);
    scrollIntoView.mockRestore();
  });

  it("asks the occasion question for a type that needs it and holds submit while blank", async () => {
    const { container, onOccasionChange, submit } = await renderReport([
      receipt({ costType: "social", typeState: "chosen" }),
    ]);

    const field = [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("composer.report.occasionLabel")
    );
    const textarea = field?.htmlFor
      ? (document.getElementById(field.htmlFor) as HTMLTextAreaElement)
      : null;
    expect(textarea?.required).toBe(true);
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toContain(
      "composer.report.submitHintOccasion"
    );

    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    await act(() => {
      setter?.call(textarea, "Board meeting, six board members");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onOccasionChange).toHaveBeenCalledWith(
      "Board meeting, six board members"
    );
  });

  it("keeps the occasion field in view when the API asked for it", async () => {
    const { container } = await renderReport(
      [receipt({ costType: "travel", typeState: "chosen" })],
      { occasionError: true }
    );

    const textarea = container.querySelector("textarea[aria-invalid]");
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    const errorId = textarea?.getAttribute("aria-describedby");
    expect(errorId && document.getElementById(errorId)?.textContent).toContain(
      "composer.report.occasionError"
    );
  });

  it("lets a missing type take the student to the receipt even when an occasion is missing too", async () => {
    const scrolled: Element[] = [];
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(function (this: HTMLElement) {
        scrolled.push(this);
      });
    const { onSubmit, submit } = await renderReport([
      receipt({ costType: "social", id: "r0", typeState: "chosen" }),
      receipt(),
    ]);

    expect(submit.disabled).toBe(false);
    await act(() => {
      submit.click();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(scrolled.map((element) => element.id)).toEqual([
      "expense-receipt-r1",
    ]);
    scrollIntoView.mockRestore();
  });

  it("keeps the occasion field once it has been shown", async () => {
    const { container, rerender } = await renderReport(
      [receipt({ costType: "social", typeState: "chosen" })],
      { occasion: "Board dinner" }
    );
    expect(container.textContent).toContain("composer.report.occasionLabel");

    // The text is cleared mid-edit and the type that asked for it changes.
    await rerender({
      occasion: "",
      receipts: [receipt({ costType: "travel", typeState: "chosen" })],
    });

    expect(container.textContent).toContain("composer.report.occasionLabel");
  });

  it("submits once every receipt has a type", async () => {
    const { container, onSubmit, submit } = await renderReport([
      receipt({ costType: "travel", typeState: "ai" }),
    ]);

    expect(container.textContent).not.toContain(
      "composer.report.occasionLabel"
    );
    await act(() => {
      submit.click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
