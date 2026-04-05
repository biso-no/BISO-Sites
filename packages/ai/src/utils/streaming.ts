/**
 * Streaming utilities for AI responses
 *
 * Provides reusable functions for handling streaming HTTP responses
 * with proper error handling and state management.
 */

export interface StreamingState {
  error: Error | null;
  isLoading: boolean;
}

export interface StreamingCallbacks {
  onChunk: (fullText: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Stream a response from an API endpoint
 *
 * @param url - The API endpoint URL
 * @param body - The request body to send
 * @param callbacks - Callbacks for handling streaming events
 * @returns The complete streamed text
 */
export async function streamResponse(
  url: string,
  body: unknown,
  callbacks: StreamingCallbacks
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    callbacks.onError?.(error);
    throw error;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const error = new Error("No response body");
    callbacks.onError?.(error);
    throw error;
  }

  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      callbacks.onChunk(fullText);
    }

    callbacks.onComplete?.(fullText);
    return fullText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Stream error");
    callbacks.onError?.(err);
    throw err;
  }
}

/**
 * Create a message updater function for streaming responses
 *
 * @param setMessages - State setter for messages array
 * @returns A function that updates the last assistant message
 */
export function createMessageUpdater<
  T extends { role: string; parts: Array<{ type: string; text: string }> },
>(
  setMessages: React.Dispatch<React.SetStateAction<T[]>>
): (fullText: string) => void {
  return (fullText: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastMessage = updated.at(-1);
      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.parts = [{ type: "text", text: fullText }];
      }
      return updated;
    });
  };
}
