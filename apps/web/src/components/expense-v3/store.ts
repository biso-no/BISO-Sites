import type { Campus, Users } from "@repo/api/types/appwrite";
import type { ReceiptIssueCode } from "@repo/shared/utils/expense-hints";
import { create } from "zustand";
import { submitGaps, type TypeState } from "./receipt-types";
import type { ExpenseTypeOption } from "./types";

type ReceiptStatus =
  | "uploading"
  | "processing"
  | "analyzing" // New state for "Generative" feel
  | "ready"
  | "error"
  | "editing";

export interface Receipt {
  aiConfidence?: number;
  aiCostType?: string | null;
  amount: number;
  bankStatementId?: string;
  bankStatementName?: string;
  bankStatementType?: string;
  category?: string; // Potential AI category
  city?: string;
  confidence: number;
  costType?: string; // Chosen or AI-suggested cost type slug
  costTypeText?: string; // The student's own type wording ("Other")
  country?: string;
  currency: string;
  date: string;
  description: string;
  documentType?: "receipt" | "bank-statement";
  error?: string;
  exchangeRate?: number;
  fileId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  id: string;
  location?: string;

  // Multi-currency support
  originalAmount?: number;
  parentId?: string; // For grouping (e.g. bank statement attached to receipt)
  possibleDuplicate?: boolean;
  progress: number;
  purchaseContext?: string;
  receiptIssues?: ReceiptIssueCode[];
  status: ReceiptStatus;
  typeState?: TypeState;
  vendor?: string; // Explicitly track vendor
}

type ExpensePhase = "draft" | "saving" | "submitting" | "complete";

interface ExpenseStore {
  addReceipt: (receipt: Receipt) => void;

  // AI-generated summary
  aiSummary: string;
  allReceiptsReady: () => boolean;

  // Campuses (for selection)
  campuses: Campus[];
  clearReceipts: () => void;

  // Assignment
  description: string;
  eventId: string | null;
  eventName: string;
  expenseId: string | null;
  insertReceiptAfter: (afterId: string, receipt: Receipt) => void;
  isGeneratingSummary: boolean;
  isReadyToSubmit: () => boolean;
  occasion: string;
  // Set when the API rejects a submit for a missing occasion.
  occasionError: boolean;
  occasionTouched: boolean;
  // Phase management
  phase: ExpensePhase;

  // User profile
  profile: Partial<Users>;

  // Receipts
  receipts: Receipt[];
  removeReceipt: (id: string) => void;

  // Reset
  reset: () => void;
  selectedCampusId: string;
  selectedCampusName: string;
  selectedDepartmentId: string;
  selectedDepartmentName: string;

  // Selection
  selectedReceiptId: string | null;
  setAiSummary: (summary: string) => void;
  setAssignment: (data: {
    campusId: string;
    campusName: string;
    departmentId: string;
    departmentName: string;
  }) => void;
  setCampuses: (campuses: Campus[]) => void;
  setDescription: (description: string) => void;
  setEvent: (eventId: string | null, eventName: string) => void;
  setExpenseId: (id: string | null) => void;
  setIsGeneratingSummary: (generating: boolean) => void;
  setOccasion: (occasion: string) => void;
  setOccasionError: (value: boolean) => void;
  setOccasionTouched: (value: boolean) => void;
  setPhase: (phase: ExpensePhase) => void;
  setProfile: (profile: Partial<Users>) => void;
  setSelectedReceiptId: (id: string | null) => void;
  setSubmissionError: (error: string | null) => void;
  setSubmitterIsFinancialManager: (value: boolean) => void;
  setTypeOptions: (options: ExpenseTypeOption[]) => void;

  // Submission
  submissionError: string | null;

  // Oslo-only: submitter is the department financial manager (routes approval
  // to the department manager instead of the financial manager).
  submitterIsFinancialManager: boolean;

  // Computed values
  totalAmount: () => number;

  // Active cost types (names only) for the type picker
  typeOptions: ExpenseTypeOption[];
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
}

const initialState = {
  phase: "draft" as ExpensePhase,
  receipts: [] as Receipt[],
  selectedReceiptId: null,
  aiSummary: "",
  isGeneratingSummary: false,
  description: "",
  occasion: "",
  occasionTouched: false,
  occasionError: false,
  eventId: null as string | null,
  eventName: "",
  selectedCampusId: "",
  selectedCampusName: "",
  selectedDepartmentId: "",
  selectedDepartmentName: "",
  profile: {} as Partial<Users>,
  campuses: [] as Campus[],
  typeOptions: [] as ExpenseTypeOption[],
  submissionError: null,
  expenseId: null,
  submitterIsFinancialManager: false,
};

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  addReceipt: (receipt) =>
    set((state) => ({ receipts: [...state.receipts, receipt] })),

  insertReceiptAfter: (afterId, receipt) =>
    set((state) => {
      const index = state.receipts.findIndex((r) => r.id === afterId);
      if (index === -1) {
        return { receipts: [...state.receipts, receipt] };
      }

      const newReceipts = [...state.receipts];
      newReceipts.splice(index + 1, 0, receipt);
      return { receipts: newReceipts };
    }),

  updateReceipt: (id, updates) =>
    set((state) => ({
      receipts: state.receipts.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  removeReceipt: (id) =>
    set((state) => ({
      receipts: state.receipts.filter((r) => r.id !== id),
      selectedReceiptId:
        state.selectedReceiptId === id ? null : state.selectedReceiptId,
    })),

  clearReceipts: () => set({ receipts: [] }),

  setSelectedReceiptId: (id) => set({ selectedReceiptId: id }),

  setAiSummary: (aiSummary) => set({ aiSummary }),
  setIsGeneratingSummary: (isGeneratingSummary) => set({ isGeneratingSummary }),

  setDescription: (description) => set({ description }),

  setOccasion: (occasion) => set({ occasion, occasionError: false }),
  setOccasionTouched: (occasionTouched) => set({ occasionTouched }),
  setOccasionError: (occasionError) => set({ occasionError }),
  setEvent: (eventId, eventName) => set({ eventId, eventName }),

  setAssignment: (data) =>
    set({
      selectedCampusId: data.campusId,
      selectedCampusName: data.campusName,
      selectedDepartmentId: data.departmentId,
      selectedDepartmentName: data.departmentName,
    }),

  setProfile: (profile) => set({ profile }),
  setCampuses: (campuses) => set({ campuses }),
  setTypeOptions: (typeOptions) => set({ typeOptions }),

  totalAmount: () => get().receipts.reduce((sum, r) => sum + r.amount, 0),

  isReadyToSubmit: () => {
    const state = get();
    const gaps = submitGaps(state.receipts, state.typeOptions, state.occasion);
    return (
      state.allReceiptsReady() &&
      state.receipts.length > 0 &&
      state.description.trim().length > 0 &&
      state.selectedCampusId !== "" &&
      state.selectedDepartmentId !== "" &&
      state.profile.bank_account !== undefined &&
      !gaps.typesMissing &&
      !gaps.occasionMissing
    );
  },

  allReceiptsReady: () =>
    get().receipts.length > 0 &&
    get().receipts.every((r) => r.status === "ready"),

  setSubmissionError: (submissionError) => set({ submissionError }),
  setExpenseId: (expenseId) => set({ expenseId }),

  setSubmitterIsFinancialManager: (submitterIsFinancialManager) =>
    set({ submitterIsFinancialManager }),

  reset: () => set(initialState),
}));
