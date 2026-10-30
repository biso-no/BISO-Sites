interface QuestionField {
  ask: (question: string) => void;
  clear: () => void;
  /** Focuses the field's input. */
  focus: () => void;
  question: string;
}

/**
 * The submit handler of both ask fields, the landing's and the page's. A
 * blank question does nothing. Otherwise focus goes to the input first: the
 * panel hands focus back to whatever had it when the question was asked, so
 * it returns to the input, ready for the next question, even after a click on
 * Ask, which is disabled once the field clears.
 */
export function submitQuestion(
  event: { preventDefault: () => void },
  { ask, clear, focus, question }: QuestionField
): void {
  event.preventDefault();
  if (!question.trim()) {
    return;
  }
  focus();
  ask(question);
  clear();
}
