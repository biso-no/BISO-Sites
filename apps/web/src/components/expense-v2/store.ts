import type { Campus, Users } from "@repo/api/types/appwrite";
import { create } from "zustand";

export type ReceiptStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "error"
  | "editing";

export interface Receipt {
  amount: number;
  confidence: number;
  currency: string;
  date: string;
  description: string;
  error?: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  id: string;
  progress: number;
  status: ReceiptStatus;
}

export type ExpensePhase =
  | "upload" // Initial state - drop receipts
  | "review" // Review extracted data
  | "assign" // Assign campus/department
  | "confirm" // Final confirmation
  | "submitting" // Submitting to server
  | "complete"; // Success state

export interface ExpenseStore {
  addReceipt: (receipt: Receipt) => void;

  // AI-generated summary
  aiSummary: string;
  allReceiptsReady: () => boolean;

  // Campuses (for selection)
  campuses: Campus[];
  clearReceipts: () => void;
  expenseId: string | null;
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

  // Assignment
  selectedCampusId: string;
  selectedCampusName: string;
  selectedDepartmentId: string;
  selectedDepartmentName: string;
  setAiSummary: (summary: string) => void;
  setAssignment: (data: {
    campusId: string;
    campusName: string;
    departmentId: string;
    departmentName: string;
  }) => void;
  setCampuses: (campuses: Campus[]) => void;
  setExpenseId: (id: string | null) => void;
  setIsGeneratingSummary: (generating: boolean) => void;
  setPhase: (phase: ExpensePhase) => void;
  setProfile: (profile: Partial<Users>) => void;
  setSubmissionError: (error: string | null) => void;

  // Submission
  submissionError: string | null;

  // Computed values
  totalAmount: () => number;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
}

const initialState = {
  phase: "upload" as ExpensePhase,
  receipts: [] as Receipt[],
  aiSummary: "",
  isGeneratingSummary: false,
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

  updateReceipt: (id, updates) =>
    set((state) => ({
      receipts: state.receipts.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  removeReceipt: (id) =>
    set((state) => ({
      receipts: state.receipts.filter((r) => r.id !== id),
    })),

  clearReceipts: () => set({ receipts: [] }),

  setAiSummary: (aiSummary) => set({ aiSummary }),
  setIsGeneratingSummary: (isGeneratingSummary) => set({ isGeneratingSummary }),

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
