import type { Campus, Users } from "@repo/api/types/appwrite";
import { create } from "zustand";

export type ReceiptStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "error"
  | "editing";

export type Receipt = {
  id: string;
  fileId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  status: ReceiptStatus;
  progress: number;
  description: string;
  amount: number;
  date: string;
  confidence: number;
  currency: string;
  error?: string;
};

export type ExpensePhase =
  | "upload" // Initial state - drop receipts
  | "review" // Review extracted data
  | "assign" // Assign campus/department
  | "confirm" // Final confirmation
  | "submitting" // Submitting to server
  | "complete"; // Success state

export type ExpenseStore = {
  // Phase management
  phase: ExpensePhase;
  setPhase: (phase: ExpensePhase) => void;

  // Receipts
  receipts: Receipt[];
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  removeReceipt: (id: string) => void;
  clearReceipts: () => void;

  // AI-generated summary
  aiSummary: string;
  setAiSummary: (summary: string) => void;
  isGeneratingSummary: boolean;
  setIsGeneratingSummary: (generating: boolean) => void;

  // Assignment
  selectedCampusId: string;
  selectedCampusName: string;
  selectedDepartmentId: string;
  selectedDepartmentName: string;
  setAssignment: (data: {
    campusId: string;
    campusName: string;
    departmentId: string;
    departmentName: string;
  }) => void;

  // User profile
  profile: Partial<Users>;
  setProfile: (profile: Partial<Users>) => void;

  // Campuses (for selection)
  campuses: Campus[];
  setCampuses: (campuses: Campus[]) => void;

  // Computed values
  totalAmount: () => number;
  isReadyToSubmit: () => boolean;
  allReceiptsReady: () => boolean;

  // Submission
  submissionError: string | null;
  setSubmissionError: (error: string | null) => void;
  expenseId: string | null;
  setExpenseId: (id: string | null) => void;

  // Reset
  reset: () => void;
};

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
