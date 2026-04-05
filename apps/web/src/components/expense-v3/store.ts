import type { Campus, Users } from "@repo/api/types/appwrite";
import { create } from "zustand";

type ReceiptStatus =
  | "uploading"
  | "processing"
  | "analyzing" // New state for "Generative" feel
  | "ready"
  | "error"
  | "editing";

export interface Receipt {
  amount: number;
  bankStatementId?: string;
  bankStatementName?: string;
  bankStatementType?: string;
  category?: string; // Potential AI category
  confidence: number;
  currency: string;
  date: string;
  description: string;
  error?: string;
  exchangeRate?: number;
  fileId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  id: string;

  // Multi-currency support
  originalAmount?: number;
  parentId?: string; // For grouping (e.g. bank statement attached to receipt)
  progress: number;
  status: ReceiptStatus;
  vendor?: string; // Explicitly track vendor
}

type ExpensePhase = "draft" | "submitting" | "complete";

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
  expenseId: string | null;
  insertReceiptAfter: (afterId: string, receipt: Receipt) => void;
  isGeneratingSummary: boolean;
  isReadyToSubmit: () => boolean;
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
  setExpenseId: (id: string | null) => void;
  setIsGeneratingSummary: (generating: boolean) => void;
  setPhase: (phase: ExpensePhase) => void;
  setProfile: (profile: Partial<Users>) => void;
  setSelectedReceiptId: (id: string | null) => void;
  setSubmissionError: (error: string | null) => void;

  // Submission
  submissionError: string | null;

  // Computed values
  totalAmount: () => number;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
}

const initialState = {
  phase: "draft" as ExpensePhase,
  receipts: [] as Receipt[],
  selectedReceiptId: null,
  aiSummary: "",
  isGeneratingSummary: false,
  description: "",
  selectedCampusId: "",
  selectedCampusName: "",
  selectedDepartmentId: "",
  selectedDepartmentName: "",
  profile: {} as Partial<Users>,
  campuses: [] as Campus[],
  submissionError: null,
  expenseId: null,
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

  setAssignment: (data) =>
    set({
      selectedCampusId: data.campusId,
      selectedCampusName: data.campusName,
      selectedDepartmentId: data.departmentId,
      selectedDepartmentName: data.departmentName,
    }),

  setProfile: (profile) => set({ profile }),
  setCampuses: (campuses) => set({ campuses }),

  totalAmount: () => get().receipts.reduce((sum, r) => sum + r.amount, 0),

  isReadyToSubmit: () => {
    const state = get();
    return (
      state.allReceiptsReady() &&
      state.receipts.length > 0 &&
      state.description.trim().length > 0 &&
      state.selectedCampusId !== "" &&
      state.selectedDepartmentId !== "" &&
      state.profile.bank_account !== undefined
    );
  },

  allReceiptsReady: () =>
    get().receipts.length > 0 &&
    get().receipts.every((r) => r.status === "ready"),

  setSubmissionError: (submissionError) => set({ submissionError }),
  setExpenseId: (expenseId) => set({ expenseId }),

  reset: () => set(initialState),
}));
