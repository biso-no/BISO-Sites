// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchApi = vi.hoisted(() => vi.fn());
const intl = vi.hoisted(() => ({ locale: "en" }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({
  useLocale: () => intl.locale,
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("motion/react", () => ({
  motion: {
    tr: ({
      animate: _animate,
      initial: _initial,
      layout: _layout,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) =>
      createElement("tr", props),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@repo/shared/utils/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/actions/expense", () => ({ uploadExpenseAttachment: vi.fn() }));
vi.mock("@/lib/actions/user", () => ({ updateProfile: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: { fetch: fetchApi } }));
vi.mock("./event-match", () => ({
  EVENT_NAME_MAX: 100,
  EventMatch: () => null,
  useNearbyEvent: () => ({ dismiss: vi.fn(), suggestion: null }),
}));
vi.mock("./receipt-wallet", () => ({ ReceiptWallet: () => null }));
vi.mock("./generative-receipt-preview", () => ({
  GenerativeReceiptPreview: () => null,
}));

import { ApiError } from "@/lib/api-error";
import { ExpenseSplitView } from "./expense-split-view";
import { type Receipt, useExpenseStore } from "./store";
import type { ExpenseTypeOption } from "./types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SETTLE_MS = 800;

const OPTIONS: ExpenseTypeOption[] = [
  { slug: "travel", label: "Travel", labelNo: "Reise", askOccasion: false },
  { slug: "social", label: "Social", labelNo: "Sosialt", askOccasion: true },
];

const CAMPUSES = [
  {
    $id: "5",
    name: "Oslo",
    departments: [{ $id: "dept-1", Name: "Events", active: true }],
  },
];

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  amount: 249,
  confidence: 1,
  costType: "travel",
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
  typeState: "chosen",
  vendor: "Peppes Pizza",
  ...overrides,
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface SummaryAnswer {
  occasionSuggestion?: string | null;
  success: boolean;
  summary: string;
}

/** Summary calls in the order they were made. */
const summaryCalls = () =>
  fetchApi.mock.calls.filter(
    ([endpoint]) => endpoint === "/api/expenses/summary"
  );

const summaryBody = (index: number) =>
  (summaryCalls()[index]?.[1] as { body: Record<string, unknown> }).body;

const state = () => useExpenseStore.getState();

let root: Root | null = null;

async function renderView() {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      createElement(ExpenseSplitView, {
        campuses: CAMPUSES,
        initialDraft: null,
        initialProfile: { bank_account: "12345678903", name: "Kari" },
        typeOptions: OPTIONS,
      } as never)
    );
  });
  await act(() => {
    state().setAssignment({
      campusId: "5",
      campusName: "Oslo",
      departmentId: "dept-1",
      departmentName: "Events",
    });
  });
  return container;
}

async function update(change: () => void) {
  await act(() => {
    change();
  });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Lets a resolved fetch reach the store. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function occasionField(container: HTMLElement): HTMLTextAreaElement {
  const label = [...container.querySelectorAll("label")].find((item) =>
    item.textContent?.includes("composer.report.occasionLabel")
  );
  return document.getElementById(label?.htmlFor ?? "") as HTMLTextAreaElement;
}

async function typeInto(field: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  await act(() => {
    setter?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ExpenseSplitView description", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetchApi.mockReset();
    intl.locale = "en";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(() => {
      root?.unmount();
    });
    root = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends one request for changes made in quick succession", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Food." });
    await renderView();

    await update(() => state().addReceipt(receipt()));
    await wait(300);
    await update(() => state().setEvent(null, "Fadder"));
    await wait(300);
    await update(() => state().setEvent(null, "Fadderuka"));
    await wait(SETTLE_MS - 1);
    expect(summaryCalls()).toHaveLength(0);

    await wait(1);
    expect(summaryCalls()).toHaveLength(1);
    expect(summaryBody(0)).toMatchObject({
      eventName: "Fadderuka",
      locale: "en",
    });

    await settle();
    expect(state().description).toBe("Food.");
    // Nothing changed since: no second request.
    await wait(SETTLE_MS * 2);
    expect(summaryCalls()).toHaveLength(1);
  });

  it("sends the student's language for the occasion suggestion", async () => {
    intl.locale = "no";
    fetchApi.mockResolvedValue({ success: true, summary: "Food." });
    await renderView();

    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS);

    expect(summaryBody(0)).toMatchObject({ locale: "no" });
    expect(
      (summaryBody(0).receipts as Array<{ costType?: string }>)[0]?.costType
    ).toBe("Reise");
  });

  it("never lets a slow older answer overwrite a newer one", async () => {
    const older = deferred<SummaryAnswer>();
    const newer = deferred<SummaryAnswer>();
    fetchApi
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await renderView();

    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS);
    expect(state().isGeneratingSummary).toBe(true);

    await update(() => state().setEvent(null, "Fadderuka"));
    await wait(SETTLE_MS);
    expect(summaryCalls()).toHaveLength(2);

    newer.resolve({ success: true, summary: "Food for Fadderuka." });
    await settle();
    expect(state().description).toBe("Food for Fadderuka.");
    expect(state().isGeneratingSummary).toBe(false);

    older.resolve({
      occasionSuggestion: "Old guess",
      success: true,
      summary: "Food.",
    });
    await settle();
    expect(state().description).toBe("Food for Fadderuka.");
    expect(state().occasion).toBe("");
    expect(state().isGeneratingSummary).toBe(false);
  });

  it("keeps showing the work while a newer request is still out", async () => {
    const older = deferred<SummaryAnswer>();
    const newer = deferred<SummaryAnswer>();
    fetchApi
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await renderView();

    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS);
    await update(() => state().setEvent(null, "Fadderuka"));
    await wait(SETTLE_MS);

    older.resolve({ success: true, summary: "Food." });
    await settle();
    expect(state().description).toBe("");
    expect(state().isGeneratingSummary).toBe(true);

    newer.resolve({ success: true, summary: "Food for Fadderuka." });
    await settle();
    expect(state().description).toBe("Food for Fadderuka.");
    expect(state().isGeneratingSummary).toBe(false);
  });

  it("fills the occasion as a suggestion until the student edits it", async () => {
    fetchApi.mockResolvedValue({
      occasionSuggestion: ` Board dinner ${"x".repeat(1200)}`,
      success: true,
      summary: "Dinner.",
    });
    const container = await renderView();

    await update(() => state().addReceipt(receipt({ costType: "social" })));
    await wait(SETTLE_MS);
    await settle();

    expect(state().occasion).toHaveLength(1000);
    expect(state().occasion.startsWith("Board dinner")).toBe(true);
    expect(state().occasionFromAi).toBe(true);
    expect(state().occasionTouched).toBe(false);
    expect(container.textContent).toContain(
      "composer.report.occasionSuggested"
    );

    await typeInto(occasionField(container), "Board dinner, six members");

    expect(state().occasion).toBe("Board dinner, six members");
    expect(state().occasionTouched).toBe(true);
    expect(state().occasionFromAi).toBe(false);
    expect(container.textContent).not.toContain(
      "composer.report.occasionSuggested"
    );
  });

  it("marks the occasion as the student's when they type it", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Dinner." });
    const container = await renderView();

    await update(() => state().addReceipt(receipt({ costType: "social" })));
    await typeInto(occasionField(container), "Board meeting");

    expect(state().occasion).toBe("Board meeting");
    expect(state().occasionTouched).toBe(true);
  });
});

describe("ExpenseSplitView submit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetchApi.mockReset();
    intl.locale = "en";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(() => {
      root?.unmount();
    });
    root = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the draft the api saved before asking for the occasion", async () => {
    fetchApi.mockImplementation((endpoint: string) => {
      if (endpoint === "/api/expenses/submit") {
        return Promise.reject(
          new ApiError("Occasion is required", 400, {
            error: "Occasion is required",
            expenseId: "expense-9",
            field: "occasion",
          })
        );
      }
      return Promise.resolve({ success: true, summary: "Travel." });
    });
    const container = await renderView();
    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS);
    await settle();
    expect(state().expenseId).toBeNull();

    const submit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("composer.report.submit")
    ) as HTMLButtonElement;
    await act(() => {
      submit.click();
    });
    await settle();

    expect(state().expenseId).toBe("expense-9");
    expect(state().occasionError).toBe(true);
    expect(state().phase).toBe("draft");

    // The next submit updates that draft.
    await act(() => {
      submit.click();
    });
    await settle();
    const submits = fetchApi.mock.calls.filter(
      ([endpoint]) => endpoint === "/api/expenses/submit"
    );
    expect(
      (submits[1]?.[1] as { body: { expenseId?: string } }).body.expenseId
    ).toBe("expense-9");
  });

  it("sends submitter_is_controller", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Travel." });
    const container = await renderView();
    await update(() => {
      state().setAssignment({
        campusId: "2",
        campusName: "Bergen",
        departmentId: "300",
        departmentName: "Ledelsen",
      });
      state().setSubmitterIsController(true);
      state().addReceipt(receipt());
    });
    await wait(SETTLE_MS);
    await settle();

    const submit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("composer.report.submit")
    ) as HTMLButtonElement;
    await act(() => {
      submit.click();
    });
    await settle();
    const call = fetchApi.mock.calls.find(
      ([endpoint]) => endpoint === "/api/expenses/submit"
    );
    expect((call?.[1] as { body: Record<string, unknown> }).body).toMatchObject(
      {
        submitter_is_controller: true,
        submitter_is_financial_manager: false,
      }
    );
  });
});
