"use server"

import { createSessionClient } from "@repo/api/server"
import { ID } from "@repo/api/client"

export async function updateProfileDetails(profileId: string, updates: {
    name?: string;
    email?: string;
    phone?: string;
    bank_account?: string;
    swift?: string | undefined;
}) {
    const { db } = await createSessionClient()

    try {
        // Remove undefined values to prevent overwriting with undefined
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
        );
        
        const updatedProfile = await db.updateDocument('app', 'user', profileId, cleanUpdates)
        return updatedProfile
    } catch (error) {
        console.error('Error updating profile:', error)
        throw new Error('Failed to update profile')
    }
}

interface DocumentData {
  date: string;
  amount: number;
  description: string;
  fileId: string;
  fileName: string;
  confidence?: number;
  needsReview?: boolean;
  processedByAI?: boolean;
  file?: File;
  url?: string;
}

// This is now just a type definition, actual processing happens in the API route
export type { DocumentData }

export async function generateExpenseDescription(descriptions: string[], eventName?: string) {
  try {
    const { functions } = await createSessionClient()

    const execution = await functions.createExecution(
      'generate_expense_description',
      JSON.stringify({
        descriptions,
        event: eventName,
        async: false
      })
    )

    if (execution.status !== 'completed') {
      throw new Error('Function execution failed');
    }

    const response = JSON.parse(execution.responseBody);
    console.log('Function response:', response); // Debug log
    
    // Check if we got an error response
    if (response.error) {
      throw new Error(response.error);
    }

    // Return just the description
    return response.description;

  } catch (error) {
    console.error('Error generating description:', error);
    throw error;
  }
}

interface ExpenseData {
  contact?: {
    name: string
    email: string
    phone: string
    bank_account: string
    swift?: string
    isInternational: boolean
    campus?: string
    department?: string
  }
  documents?: Array<{
    fileId: string
    fileName: string
    date: string
    amount: number
    description: string
    file?: File
    url?: string
    originalCurrency?: string
    exchangeRate?: number
    bankStatement?: {
      fileId: string
      fileName: string
      date: string
      file?: File
    }
  }>
  description?: {
    description: string
    additionalNotes?: string
    hasPrepayment?: boolean
    prepaymentAmount?: number
  }
}

export async function uploadExpenseFile(file: File) {
  try {
    const { storage } = await createSessionClient();
    const uploadedFile = await storage.createFile(
      'expenses', 
      ID.unique(),
      file
    );
    return uploadedFile.$id;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function submitExpense(data: ExpenseData, userId: string) {
  try {
    const { storage, db } = await createSessionClient();
    
    // Prepare all documents including bank statements for upload
    const allDocuments = [];
    
    // Process main documents and their bank statements
    data.rows?.forEach(doc => {
      // Add the main document
      allDocuments.push(doc);
      
      // If it has a bank statement, add it as a separate document
      if (doc.bankStatement && doc.bankStatement.file) {
        const bankStatementDoc = {
          fileId: doc.bankStatement.fileId,
          fileName: doc.bankStatement.fileName,
          date: doc.bankStatement.date,
          amount: 0, // Bank statements don't have an amount
          description: `Bank statement for ${doc.fileName} (${doc.originalCurrency})`,
          file: doc.bankStatement.file
        };
        allDocuments.push(bankStatementDoc);
      }
    });
    
    // Upload all files
    const uploadPromises = allDocuments.map(async (doc) => {
      if (doc.file) {
        const fileId = await uploadExpenseFile(doc.file);
        const url = process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT + '/storage/buckets/expenses/files/' + fileId + '/view?project=' + process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
        return { ...doc, fileId, file: undefined, url };
      }
      return doc;
    });

    const documentsWithFileIds = await Promise.all(uploadPromises);
    
    // Filter out supporting documents before calculating total
    const totalAmount = documentsWithFileIds
      .filter(doc => !doc.description?.startsWith('Bank statement for'))
      .reduce((sum, doc) => sum + doc.amount, 0) || 0;
    
    const prepaymentAmount = data.description?.prepaymentAmount || 0;
    

    const expenseData = {
      campus: data.contact?.campus,
      department: data.contact?.department,
      bank_account: data.contact?.bank_account,
      description: data.description?.description,
      total: totalAmount - prepaymentAmount,
      prepayment_amount: prepaymentAmount,
      status: 'pending',
      userId: userId,
      user: userId,
      expenseAttachments: documentsWithFileIds.map(doc => ({
        date: new Date(doc.date).toISOString(),
        amount: doc.amount,
        description: doc.description,
        type: doc.fileName.split('.').pop()?.toLowerCase() || 'unknown',
        url: doc.url
      }))
    }

    const response = await db.createDocument(
      'app',
      'expense',
      ID.unique(),
      expenseData
    )

    return { success: true, data: response }
  } catch (error) {
    console.error('Error submitting expense:', error)
    return { success: false, error: 'Failed to submit expense' }
  }
}