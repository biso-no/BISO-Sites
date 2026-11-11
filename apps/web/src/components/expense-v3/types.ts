/** A cost type as the student form sees it: names only, never account numbers. */
export interface ExpenseTypeOption {
  askOccasion: boolean;
  label: string;
  labelNo: string | null;
  slug: string;
}
