// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchApi = vi.hoisted(() => vi.fn());
const fetchFormData = vi.hoisted(() => vi.fn());
const wallet = vi.hoisted(() => ({
  upload: (_files: File[]) => undefined as unknown,
}));
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
vi.mock("@/lib/api-client", () => ({
  apiClient: { fetch: fetchApi, fetchFormData },
}));
vi.mock("./event-match", () => ({
  EVENT_NAME_MAX: 100,
  EventMatch: () => null,
  useNearbyEvent: () => ({ dismiss: vi.fn(), suggestion: null }),
}));
vi.mock("./receipt-wallet", () => ({
  ReceiptWallet: ({ onUpload }: { onUpload: (files: File[]) => void }) => {
    wallet.upload = onUpload;
    return null;
  },
}));
vi.mock("./generative-receipt-preview", () => ({
  GenerativeReceiptPreview: () => null,
}));

import { uploadExpenseAttachment } from "@/lib/actions/expense";
import { ApiError } from "@/lib/api-error";
import { ExpenseSplitView } from "./expense-split-view";
import { missingTypes } from "./receipt-types";
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

describe("ExpenseSplitView reopened draft", () => {
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

  it("shows a saved controller switch on Ledelsen as on", async () => {
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(() => {
      root?.render(
        createElement(ExpenseSplitView, {
          campuses: [
            {
              $id: "2",
              name: "Bergen",
              departments: [{ $id: "300", Name: "Ledelsen", active: true }],
            },
          ],
          initialDraft: {
            $id: "expense-1",
            bank_account: "12345678903",
            campus: "2",
            department: "300",
            description: "Travel.",
            eventName: null,
            event_id: null,
            expenseAttachments: [],
            occasion: null,
            submitter_is_controller: true,
            submitter_is_financial_manager: false,
            total: 0,
          },
          initialProfile: { bank_account: "12345678903", name: "Kari" },
          typeOptions: OPTIONS,
        } as never)
      );
    });

    // The assignment is restored before the switch, which a change of
    // department would otherwise clear.
    expect(state().selectedDepartmentId).toBe("300");
    expect(state().submitterIsController).toBe(true);
    const toggle =
      container.querySelector<HTMLInputElement>("#controller-toggle");
    expect(toggle?.checked).toBe(true);
  });
});

async function renderDraft(description: string) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      createElement(ExpenseSplitView, {
        campuses: CAMPUSES,
        initialDraft: {
          $id: "expense-1",
          bank_account: "12345678903",
          campus: "5",
          department: "dept-1",
          description,
          eventName: null,
          event_id: null,
          expenseAttachments: [],
          occasion: null,
          submitter_is_controller: false,
          submitter_is_financial_manager: false,
          total: 0,
        },
        initialProfile: { bank_account: "12345678903", name: "Kari" },
        typeOptions: OPTIONS,
      } as never)
    );
  });
}

describe("ExpenseSplitView reopened draft description", () => {
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

  it("a reopened draft with an empty description gets one once every receipt has a type", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Food." });
    await renderDraft("");

    await update(() =>
      state().addReceipt(
        receipt({ costType: undefined, typeState: "needs_choice" })
      )
    );
    await wait(SETTLE_MS * 2);
    expect(summaryCalls()).toHaveLength(0);

    await update(() =>
      state().updateReceipt("r1", { costType: "travel", typeState: "chosen" })
    );
    await wait(SETTLE_MS);
    expect(summaryCalls()).toHaveLength(1);
  });

  it("a reopened draft's description survives later receipt changes", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Overwritten." });
    await renderDraft("Saved earlier");

    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS * 2);
    await update(() =>
      state().addReceipt(
        receipt({ id: "r2", fileId: "f2", costType: "social" })
      )
    );
    await wait(SETTLE_MS * 2);
    await update(() =>
      state().updateReceipt("r1", { costType: "social", typeState: "chosen" })
    );
    await wait(SETTLE_MS * 2);
    await settle();
    expect(summaryCalls()).toHaveLength(0);
    expect(state().description).toBe("Saved earlier");
  });

  it("a reopened draft keeps a saved description", async () => {
    fetchApi.mockResolvedValue({ success: true, summary: "Food." });
    await renderDraft("Saved earlier");

    await update(() => state().addReceipt(receipt()));
    await wait(SETTLE_MS * 2);
    expect(summaryCalls()).toHaveLength(0);
    expect(state().description).toBe("Saved earlier");
  });
});

describe("ExpenseSplitView failed scan", () => {
  const file = () => new File(["x"], "pizza.jpg", { type: "image/jpeg" });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetchApi.mockReset();
    fetchFormData.mockReset();
    vi.mocked(uploadExpenseAttachment).mockReset();
    intl.locale = "en";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:x" })
    );
  });

  afterEach(async () => {
    await act(() => {
      root?.unmount();
    });
    root = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const uploadOk = () =>
    vi
      .mocked(uploadExpenseAttachment)
      .mockResolvedValue({ success: true, file: { $id: "f9" } } as never);

  const upload = async () => {
    await act(async () => {
      wallet.upload([file()]);
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  it("a receipt whose scan fails becomes ready for manual entry", async () => {
    uploadOk();
    fetchFormData.mockRejectedValue(new Error("boom"));
    await renderView();
    await upload();

    const [added] = state().receipts;
    expect(added.status).toBe("ready");
    expect(added.scanFailed).toBe(true);
    expect(added.costType).toBeUndefined();
    expect(added.typeState).toBe("needs_choice");
  });

  it("the scan request carries the selected department", async () => {
    uploadOk();
    fetchFormData.mockRejectedValue(new Error("boom"));
    await renderView();
    await upload();

    const [, init] = fetchFormData.mock.calls[0];
    expect((init.body as FormData).get("departmentId")).toBe("dept-1");
  });

  it("a failed upload stays an error", async () => {
    vi.mocked(uploadExpenseAttachment).mockResolvedValue({
      success: false,
      error: "no",
    } as never);
    await renderView();
    await upload();

    expect(state().receipts[0].status).toBe("error");
    expect(fetchFormData).not.toHaveBeenCalled();
  });

  it("a supporting document whose scan fails needs no type", () => {
    expect(
      missingTypes([
        receipt({ id: "p", costType: "travel" }),
        receipt({
          amount: 0,
          costType: undefined,
          id: "s",
          parentId: "p",
          scanFailed: true,
          typeState: "needs_choice",
        }),
      ])
    ).toEqual([]);
  });

  it("try again reads the receipt and keeps what the student typed", async () => {
    uploadOk();
    fetchFormData.mockRejectedValueOnce(new Error("boom"));
    const container = await renderView();
    await upload();
    await update(() =>
      state().updateReceipt(state().receipts[0].id, {
        amount: 120,
        vendor: "My shop",
      })
    );

    fetchFormData.mockResolvedValueOnce({
      success: true,
      data: {
        amount: 99,
        currency: "NOK",
        date: "2026-11-01",
        vendor: "OCR shop",
      },
    });
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "retry"
    );
    await act(async () => {
      retry?.click();
      await vi.advanceTimersByTimeAsync(2000);
    });

    const [after] = state().receipts;
    expect(after.amount).toBe(120);
    expect(after.vendor).toBe("My shop");
    expect(after.date).toBe("2026-11-01");
    expect(after.scanFailed).toBe(false);
    expect(after.status).toBe("ready");
  });

  const retryButton = (container: HTMLElement) =>
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "retry"
    );

  it("a failed retry keeps what the student entered", async () => {
    uploadOk();
    fetchFormData.mockRejectedValue(new Error("boom"));
    const container = await renderView();
    await upload();
    const id = state().receipts[0].id;
    await update(() =>
      state().updateReceipt(id, {
        amount: 120,
        costType: "travel",
        typeState: "chosen",
      })
    );

    await act(async () => {
      retryButton(container)?.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    const [after] = state().receipts;
    expect(after.status).toBe("ready");
    expect(after.scanFailed).toBe(true);
    expect(after.amount).toBe(120);
    expect(after.costType).toBe("travel");
    expect(after.typeState).toBe("chosen");
  });

  const RECEIPT_FILE = () =>
    new File(["r"], "pizza.jpg", { type: "image/jpeg" });
  const STATEMENT_FILE = () =>
    new File(["s"], "statement.pdf", { type: "application/pdf" });
  const READ = {
    "pizza.jpg": {
      amount: 249,
      currency: "NOK",
      date: "2026-11-01",
      documentType: "receipt",
      vendor: "Peppes Pizza",
    },
    "second.jpg": {
      amount: 120,
      currency: "NOK",
      date: "2026-11-01",
      documentType: "receipt",
      vendor: "Peppes Pizza",
    },
    "statement.pdf": {
      amount: 300,
      currency: "NOK",
      date: "2026-11-01",
      documentType: "bank-statement",
      vendor: "Peppes Pizza",
    },
  } as const;
  /** Reads each file by name; the named files fail on their first read. */
  const scansFailingFirst = (failing: string[]) => {
    const reads = new Map<string, number>();
    fetchFormData.mockImplementation(
      (_url: string, init: { body: FormData }) => {
        const name = (init.body.get("file") as File).name;
        const count = (reads.get(name) ?? 0) + 1;
        reads.set(name, count);
        if (failing.includes(name) && count === 1) {
          return Promise.reject(new Error("boom"));
        }
        return Promise.resolve({
          success: true,
          data: READ[name as keyof typeof READ],
        });
      }
    );
  };
  const uploadsAs = (...ids: string[]) => {
    for (const id of ids) {
      vi.mocked(uploadExpenseAttachment).mockResolvedValueOnce({
        success: true,
        file: { $id: id },
      } as never);
    }
  };
  const byName = (name: string) =>
    state().receipts.find((r) => r.fileName === name);

  it("a retried scan links its bank statement like the batch upload does", async () => {
    uploadsAs("f-receipt", "f-statement");
    scansFailingFirst(["pizza.jpg"]);
    const container = await renderView();
    await act(async () => {
      wallet.upload([RECEIPT_FILE(), STATEMENT_FILE()]);
      await vi.advanceTimersByTimeAsync(2000);
    });
    // The batch check had nothing to link: the receipt was not read.
    expect(byName("statement.pdf")?.parentId).toBeUndefined();

    await act(async () => {
      retryButton(container)?.click();
      await vi.advanceTimersByTimeAsync(2000);
    });

    const receiptId = byName("pizza.jpg")?.id;
    expect(byName("statement.pdf")).toMatchObject({
      amount: 0,
      parentId: receiptId,
    });
    expect(byName("pizza.jpg")?.bankStatementId).toBe("f-statement");
  });

  it("a retried scan leaves a statement the batch already linked alone", async () => {
    uploadsAs("f-receipt", "f-statement", "f-second");
    scansFailingFirst(["second.jpg"]);
    const container = await renderView();
    await act(async () => {
      wallet.upload([
        RECEIPT_FILE(),
        STATEMENT_FILE(),
        new File(["x"], "second.jpg", { type: "image/jpeg" }),
      ]);
      await vi.advanceTimersByTimeAsync(2000);
    });
    const firstId = byName("pizza.jpg")?.id;
    expect(byName("statement.pdf")?.parentId).toBe(firstId);
    await update(() =>
      state().updateReceipt(firstId as string, { amount: 280 })
    );

    await act(async () => {
      retryButton(container)?.click();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(byName("statement.pdf")?.parentId).toBe(firstId);
    expect(byName("pizza.jpg")?.amount).toBe(280);
    expect(byName("second.jpg")?.bankStatementId).toBeUndefined();
  });

  it("a statement linked on retry stays with its receipt when another file finishes later", async () => {
    uploadsAs("f-receipt", "f-statement", "f-second");
    let finishSecond: (value: unknown) => void = () => undefined;
    const reads = new Map<string, number>();
    fetchFormData.mockImplementation(
      (_url: string, init: { body: FormData }) => {
        const name = (init.body.get("file") as File).name;
        const count = (reads.get(name) ?? 0) + 1;
        reads.set(name, count);
        if (name === "pizza.jpg" && count === 1) {
          return Promise.reject(new Error("boom"));
        }
        if (name === "second.jpg") {
          return new Promise((resolve) => {
            finishSecond = resolve;
          });
        }
        return Promise.resolve({
          success: true,
          data: READ[name as keyof typeof READ],
        });
      }
    );
    const container = await renderView();
    await act(async () => {
      wallet.upload([
        RECEIPT_FILE(),
        STATEMENT_FILE(),
        new File(["x"], "second.jpg", { type: "image/jpeg" }),
      ]);
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      retryButton(container)?.click();
      await vi.advanceTimersByTimeAsync(2000);
    });
    const firstId = byName("pizza.jpg")?.id;
    expect(byName("statement.pdf")?.parentId).toBe(firstId);

    await act(async () => {
      finishSecond({ success: true, data: READ["second.jpg"] });
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(byName("statement.pdf")?.parentId).toBe(firstId);
    expect(byName("second.jpg")?.bankStatementId).toBeUndefined();
  });

  it("linking a statement on retry keeps an amount the student typed", async () => {
    uploadsAs("f-receipt", "f-statement");
    scansFailingFirst(["pizza.jpg"]);
    const container = await renderView();
    await act(async () => {
      wallet.upload([RECEIPT_FILE(), STATEMENT_FILE()]);
      await vi.advanceTimersByTimeAsync(2000);
    });
    await update(() =>
      state().updateReceipt(byName("pizza.jpg")?.id as string, { amount: 280 })
    );

    await act(async () => {
      retryButton(container)?.click();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(byName("pizza.jpg")?.bankStatementId).toBe("f-statement");
    expect(byName("pizza.jpg")?.amount).toBe(280);
  });

  it("the try again button does not open the receipt", async () => {
    uploadOk();
    fetchFormData.mockRejectedValue(new Error("boom"));
    const container = await renderView();
    await upload();

    const button = retryButton(container);
    expect(button?.closest("[data-row-control]")).not.toBeNull();
  });
});
