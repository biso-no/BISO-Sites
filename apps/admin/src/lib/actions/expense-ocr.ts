"use server";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

interface ProcessedReceiptData {
  date: string | null;
  amount: number | null;
  description: string | null;
  confidence: number;
  currency?: string | null;
}

/**
 * Process a receipt file using OCR to extract data
 * This calls the client-side API route that handles the OCR processing
 */
export async function processReceipt(fileId: string, fileUrl: string): Promise<{
  success: boolean;
  data?: ProcessedReceiptData;
  error?: string;
}> {
  try {
    // Fetch the file from Appwrite storage
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error("Failed to fetch file from storage");
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Import the processing function server-side
    const { processDocument } = await import("@/lib/services/document-processing");
    
    const result = await processDocument(buffer, blob.type);

    return {
      success: true,
      data: {
        date: result.date,
        amount: result.amount,
        description: result.description,
        confidence: result.confidence,
        currency: result.currency,
      },
    };
  } catch (error) {
    console.error("Error processing receipt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process receipt",
    };
  }
}

/**
 * Generate an AI description for the expense based on attachment data
 */
export async function generateExpenseDescription(attachments: Array<{
  description: string;
  amount: number;
  date: string;
}>): Promise<{
  success: boolean;
  description?: string;
  error?: string;
}> {
  try {
    if (attachments.length === 0) {
      return {
        success: false,
        error: "No attachments provided",
      };
    }

    const totalAmount = attachments.reduce((sum, att) => sum + att.amount, 0);
    
    const attachmentDetails = attachments.map((att, index) => 
      `${index + 1}. ${att.description} - ${att.amount} NOK (${att.date})`
    ).join("\n");

    const prompt = `You are an assistant helping to create concise expense reimbursement descriptions for a student organization (BISO - BI Student Organisation).

Based on the following receipt information, generate a brief, professional description for the expense reimbursement request in Norwegian (Bokmål). The description should:
- Be 1-2 sentences maximum
- Mention what was purchased
- Be suitable for accounting purposes
- Use professional but friendly language

Receipts:
${attachmentDetails}

Total: ${totalAmount} NOK

Generate only the description text, no additional formatting or explanations.`;

    const { text } = await generateText({
      model: openai("gpt-5-mini"),
      prompt,
      maxOutputTokens: 150,
      temperature: 0.7,
    });

    return {
      success: true,
      description: text.trim(),
    };
  } catch (error) {
    console.error("Error generating description:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate description",
    };
  }
}

/**
 * Process multiple receipts in parallel
 */
async function processMultipleReceipts(
  files: Array<{ id: string; url: string }>
): Promise<{
  success: boolean;
  results?: Array<{ fileId: string; data: ProcessedReceiptData | null; error?: string }>;
  error?: string;
}> {
  try {
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const result = await processReceipt(file.id, file.url);
        return {
          fileId: file.id,
          data: result.success ? result.data! : null,
          error: result.error,
        };
      })
    );

    const processedResults = results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          fileId: "unknown",
          data: null,
          error: result.reason?.message || "Processing failed",
        };
      }
    });

    return {
      success: true,
      results: processedResults,
    };
  } catch (error) {
    console.error("Error processing multiple receipts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process receipts",
    };
  }
}

/**
 * Validate and enhance receipt data using AI
 */
async function validateReceiptData(data: {
  description: string;
  amount: number;
  date: string;
}): Promise<{
  success: boolean;
  isValid: boolean;
  suggestions?: string[];
  error?: string;
}> {
  try {
    const prompt = `You are validating expense receipt data for a student organization.

Receipt data:
- Description: ${data.description}
- Amount: ${data.amount} NOK
- Date: ${data.date}

Check if this data looks reasonable and provide any validation concerns as a JSON array of strings.
Consider:
- Is the amount reasonable? (flag if > 10000 NOK)
- Is the date in the future?
- Is the description clear enough for accounting?

Respond with ONLY a JSON object in this format:
{
  "isValid": true/false,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

    const { text } = await generateText({
      model: openai("gpt-5-mini"),
      prompt,
      maxOutputTokens: 200,
      temperature: 0.3,
    });

    const result = JSON.parse(text);

    return {
      success: true,
      isValid: result.isValid,
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error("Error validating receipt data:", error);
    return {
      success: false,
      isValid: true, // Default to valid if validation fails
      error: error instanceof Error ? error.message : "Failed to validate receipt",
    };
  }
}

