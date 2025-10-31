"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@repo/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { useToast } from "@repo/ui/components/ui/use-toast"
import {
  FileText,
  CreditCard,
  File,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert"
import { format } from "date-fns"
import { ID } from "@repo/api/client"
import { submitExpense } from '../../../actions'
import { useAuth } from "@/lib/hooks/useAuth"
import { FilePreview } from "../../file-preview"
import { cn } from '@repo/ui/lib/utils'
import React from "react"

interface ExpenseConfirmationProps {
  onPrevious: () => void
  data: {
    contact?: {
      name: string;
      email: string;
      phone: string;
      bank_account: string;
      swift?: string;
      isInternational: boolean;
      campus?: string;
      department?: string;
    };
    documents?: Array<{
      fileId: string;
      fileName: string;
      date: string;
      amount: number;
      description: string;
      file?: File;
      originalCurrency?: string;
      bankStatement?: {
        fileId: string;
        fileName: string;
        file: File;
        date: string;
      };
    }>;
    description?: {
      description: string;
      additionalNotes?: string;
      hasPrepayment: boolean;
      prepaymentAmount?: number;
    };
  }
}

// Utility functions for formatting
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Use narrow non-breaking space for tighter formatting
  const narrowSpace = '\u202F'
  
  // Check if it's a Norwegian phone number (8 digits)
  if (digits.length === 8 && (digits.startsWith('4') || digits.startsWith('9'))) {
    // Format as xxx xx xxx with narrow spaces
    return `${digits.slice(0, 3)}${narrowSpace}${digits.slice(3, 5)}${narrowSpace}${digits.slice(5)}`
  }
  
  // For international numbers, try to format with country code
  if (digits.length > 8) {
    // If it starts with country code
    if (digits.startsWith('47')) {
      const nationalNumber = digits.slice(2)
      if (nationalNumber.length === 8) {
        return `+47${narrowSpace}${nationalNumber.slice(0, 3)}${narrowSpace}${nationalNumber.slice(3, 5)}${narrowSpace}${nationalNumber.slice(5)}`
      }
    }
    
    // Generic international format with + prefix if not already there
    return phone.startsWith('+') ? phone : `+${digits}`
  }
  
  // Return original if we can't format it
  return phone
}

const formatBankAccount = (account: string, isInternational: boolean): string => {
  // Remove all spaces and non-alphanumeric characters
  const cleaned = account.replace(/\s/g, '')
  
  // Use narrow non-breaking space for tighter formatting
  const narrowSpace = '\u202F'
  
  // If it's an IBAN (international)
  if (isInternational || cleaned.length > 11) {
    // Format IBAN with narrow spaces every 4 characters
    return cleaned.replace(/(.{4})/g, `$1${narrowSpace}`).trim()
  }
  
  // Norwegian account number (11 digits: xxxx xx xxxxx)
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 4)}${narrowSpace}${cleaned.slice(4, 6)}${narrowSpace}${cleaned.slice(6)}`
  }
  
  // Return original if we can't format it
  return account
}

export function ExpenseConfirmation({
  onPrevious,
  data,
}: ExpenseConfirmationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAgreed, setHasAgreed] = useState(false)
  const { toast } = useToast()
  const { profile } = useAuth()
  const [previewFileId, setPreviewFileId] = useState<string | undefined>()

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const totalAmount = data.rows?.reduce((sum, doc) => sum + doc.amount, 0) || 0

  const handleSubmit = async () => {
    if (!hasAgreed) {
      toast({
        title: "Agreement Required",
        description: "Please confirm that all information is correct before submitting.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitExpense(data, profile.$id)
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Your expense claim has been submitted successfully.",
        })
        // Redirect to success page or expense list
        window.location.href = '/expenses'
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error submitting expense:', error)
      toast({
        title: "Error",
        description: "Failed to submit expense claim. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Expense Claim</CardTitle>
          <CardDescription>
            Please review all information before submitting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact & Bank Details</h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{data.contact?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{data.contact?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium font-mono">
                  {data.contact?.phone ? formatPhoneNumber(data.contact.phone) : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Account</p>
                <p className="font-medium font-mono">
                  {data.contact?.bank_account 
                    ? formatBankAccount(data.contact.bank_account, data.contact.isInternational) 
                    : ''}
                </p>
              </div>
              {data.contact?.isInternational && data.contact?.swift && (
                <div>
                  <p className="text-sm text-gray-500">SWIFT/BIC Code</p>
                  <p className="font-medium font-mono">{data.contact.swift}</p>
                </div>
              )}
            </div>
          </div>

          {/*Campus & Department*/}
          <div>
            <h3 className="text-lg font-semibold mb-4">Campus & Department</h3>
            <p className="font-medium">{data.contact?.campus}</p>
            <p className="font-medium">{data.contact?.department}</p>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Documents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows?.map((doc) => (
                  <React.Fragment key={doc.fileId}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div 
                          className={cn(
                            "flex items-center gap-2 cursor-pointer hover:text-blue-500",
                            previewFileId === doc.fileId && "text-blue-500"
                          )}
                          onClick={() => setPreviewFileId(doc.fileId)}
                        >
                          <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                            {doc.file && (
                              <iframe
                                src={URL.createObjectURL(doc.file)}
                                className="w-full h-full"
                                style={{ pointerEvents: 'none' }}
                              />
                            )}
                          </div>
                          <div>
                            {doc.fileName}
                            {doc.originalCurrency && doc.originalCurrency !== 'NOK' && (
                              <span className="text-xs ml-2 rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5">
                                {doc.originalCurrency}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(doc.date), 'PP')}</TableCell>
                      <TableCell>{formatAmount(doc.amount)} kr</TableCell>
                      <TableCell>{doc.description}</TableCell>
                    </TableRow>
                    
                    {/* Bank Statement Row */}
                    {doc.bankStatement && (
                      <TableRow key={`${doc.fileId}-bank-statement`} className="bg-green-50/50">
                        <TableCell className="pl-8 border-t-0">
                          <div 
                            className={cn(
                              "flex items-center gap-2 cursor-pointer hover:text-blue-500",
                              previewFileId === doc.bankStatement.fileId && "text-blue-500"
                            )}
                            onClick={() => setPreviewFileId(doc.bankStatement.fileId)}
                          >
                            <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                              {doc.bankStatement.file && (
                                <iframe
                                  src={URL.createObjectURL(doc.bankStatement.file)}
                                  className="w-full h-full"
                                  style={{ pointerEvents: 'none' }}
                                />
                              )}
                            </div>
                            <div className="flex items-center">
                              <CheckCircle2 className="h-3 w-3 text-green-600 mr-1" />
                              <span className="text-sm text-green-700 mr-1">Bank Statement:</span>
                              <span className="text-sm">{doc.bankStatement.fileName}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(doc.bankStatement.date), 'PP')}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell><span className="text-xs text-gray-500">Supporting document</span></TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-semibold">
                    Total Amount:
                  </TableCell>
                  <TableCell className="font-semibold text-blue-600">
                    {formatAmount(totalAmount)} kr
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Description</h3>
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{data.description?.description}</p>
              </div>
              {data.description?.additionalNotes && (
                <div>
                  <p className="text-sm text-gray-500">Additional Notes</p>
                  <p className="whitespace-pre-wrap">{data.description.additionalNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* After the documents section */}
          {data.description?.hasPrepayment && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Prepayment Details</h3>
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Prepayment Amount</p>
                  <p className="font-medium">{formatAmount(data.description.prepaymentAmount || 0)} kr</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Remaining Balance</p>
                  <p className="font-medium text-blue-600">
                    {formatAmount(totalAmount - (data.description.prepaymentAmount || 0))} kr
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="agreement"
          checked={hasAgreed}
          onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
        />
        <label
          htmlFor="agreement"
          className="text-sm text-gray-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          I confirm that all information provided is correct and complete
        </label>
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          disabled={isSubmitting}
        >
          Previous
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !hasAgreed}
          className="bg-linear-to-r from-blue-500 to-indigo-500 text-white px-8"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Expense Claim'
          )}
        </Button>
      </div>

      <AnimatePresence>
        {previewFileId && (
          <FilePreview
            files={[
              ...(data.rows?.map(doc => ({
                fileId: doc.fileId,
                fileName: doc.fileName,
                file: doc.file
              })) || []),
              ...(data.rows?.filter(doc => doc.bankStatement?.file)
                .map(doc => ({
                  fileId: doc.bankStatement!.fileId,
                  fileName: `Bank Statement: ${doc.bankStatement!.fileName}`,
                  file: doc.bankStatement!.file
                })) || [])
            ]}
            currentFileId={previewFileId}
            onClose={() => setPreviewFileId(undefined)}
            onFileChange={setPreviewFileId}
          />
        )}
      </AnimatePresence>
    </div>
  )
} 