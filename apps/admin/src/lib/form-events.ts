/**
 * Simple event emitter for form field updates from the AI assistant
 * This allows the assistant sidebar to communicate with forms on any page
 */

export type FormFieldUpdate = {
  fieldId: string;
  fieldName: string;
  value: string;
};

type FormFieldListener = (update: FormFieldUpdate) => void;

class FormEventEmitter {
  private readonly listeners: Set<FormFieldListener> = new Set();

  /**
   * Subscribe to form field updates
   * Returns an unsubscribe function
   */
  subscribe(listener: FormFieldListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a form field update to all listeners
   */
  emit(update: FormFieldUpdate): void {
    for (const listener of this.listeners) {
      try {
        listener(update);
      } catch (error) {
        console.error("Error in form field listener:", error);
      }
    }
  }

  /**
   * Check if there are any active listeners
   */
  hasListeners(): boolean {
    return this.listeners.size > 0;
  }
}

// Singleton instance
export const formEvents = new FormEventEmitter();
