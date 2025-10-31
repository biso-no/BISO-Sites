"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useDropzone } from "react-dropzone"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog"
import {
  Upload,
  File,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Edit2,
  Save,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { cn } from '@repo/ui/lib/utils'
import type { DocumentData as ActionDocumentData } from '../../../actions'
import { useToast } from "@repo/ui/components/ui/use-toast"
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert"
// Use API route for document processing to keep heavy OCR libs isolated server-side
import { Switch } from "@repo/ui/components/ui/switch"
import { Label } from "@repo/ui/components/ui/label"
import { generateExpenseDescription } from '../../../actions'
import { FilePreview } from "../../file-preview"
import Image from "next/image"

interface DocumentData {
  date: string;
  amount: number;  // This will always be the NOK amount
  description: string;
  fileId: string;
  fileName: string;
  file: File;
  processedByAI: boolean;
  originalAmount?: number;  // The amount in foreign currency (if any)
  originalCurrency?: string;  // The currency code (if not NOK)
  exchangeRate?: number;  // For display purposes only
  bankStatement?: {
    fileId: string;
    fileName: string;
    file: File;
    date: string;
  };
}


interface DocumentUploadProps {
  onNext: () => void
  onPrevious: () => void
  onUpdate: (data: any) => void
  data?: {
    documents?: ActionDocumentData[];
    aiEnabled?: boolean;
  }
}

const formatAmount = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return "0.00";
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const [year, month, day] = dateString.split('-');
    return `${day}.${month}.${year}`;
  } catch (error) {
    // Return original if format is unexpected
    return dateString;
  }
};

const documentSchema = z.object({
  date: z.string(),
  amount: z.number().min(0),
  description: z.string().min(1),
  exchangeRate: z.number().optional(),
})

interface AIToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const AIToggle = ({ enabled, onToggle }: AIToggleProps) => (
  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
    <Label 
      htmlFor="ai-toggle" 
      className="text-sm font-medium text-gray-600 cursor-pointer"
    >
      AI Assistance
    </Label>
    <Switch
      id="ai-toggle"
      checked={enabled}
      onCheckedChange={onToggle}
      className="data-[state=checked]:bg-linear-to-r from-blue-500 to-indigo-500"
    />
  </div>
);

// Update the DocumentAlerts component to accept the necessary functions
const DocumentAlerts = ({ 
  doc, 
  onAttachBankStatement,
  onPreviewBankStatement,
  onRemoveBankStatement
}: { 
  doc: DocumentData, 
  onAttachBankStatement?: (docId: string) => void,
  onPreviewBankStatement?: (fileId: string) => void,
  onRemoveBankStatement?: (docId: string) => void
}) => {
  const alerts = [];
  
  if (doc.originalCurrency && doc.originalCurrency !== 'NOK') {
    if (doc.bankStatement) {
      // If bank statement is attached, just show the bank statement without the warning
      alerts.push(
        <div key="bank-statement" className="bg-green-50 border border-green-200 rounded-md p-2 mt-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {doc.bankStatement.file && (
                <DocumentThumbnail file={doc.bankStatement.file} />
              )}
              <div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <p className="text-xs font-medium text-green-700">Bank Statement Attached</p>
                </div>
                <p className="text-xs text-gray-600 truncate max-w-48">
                  {doc.bankStatement.fileName} ({formatDate(doc.bankStatement.date)})
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 p-1 px-2 text-xs border-green-200 bg-green-50/80 hover:bg-green-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewBankStatement?.(doc.bankStatement!.fileId);
                }}
              >
                View
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBankStatement?.(doc.fileId);
                }}
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          </div>
        </div>
      );
    } else {
      // If no bank statement is attached, show the warning with the attach button
      alerts.push(
        <Alert key="foreign" className="p-2 bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between w-full min-h-[24px]">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
              <AlertDescription className="ml-2 my-0 text-yellow-700">
                Foreign currency detected. Bank statements may be required.
              </AlertDescription>
            </div>
            {onAttachBankStatement && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAttachBankStatement(doc.fileId);
                }}
              >
                Attach Bank Statement
              </Button>
            )}
          </div>
        </Alert>
      );
    }
  }
  
  return alerts.length > 0 ? (
    <div className="space-y-2 mb-4">{alerts}</div>
  ) : null;
};

// Fix the DocumentThumbnail component to use Next.js Image
const DocumentThumbnail = ({ file }: { file: File }) => {
  // Create a safe file extension for the icon display
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = fileExt === 'pdf';
  const [objectUrl, setObjectUrl] = useState<string>('');
  
  useEffect(() => {
    // Create object URL for the file
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    
    // Clean up the URL when component unmounts
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 relative">
      {isPdf ? (
        <div className="flex flex-col items-center justify-center">
          <FileText className="w-6 h-6 text-red-400" />
          <span className="text-[10px] uppercase font-semibold mt-1 text-gray-500">PDF</span>
        </div>
      ) : objectUrl ? (
        <div className="relative w-full h-full">
          <Image
            src={objectUrl}
            alt="Document preview"
            fill
            className="object-cover"
            onError={() => {
              setObjectUrl('');
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <FileText className="w-6 h-6 text-blue-400" />
          <span className="text-[10px] uppercase font-semibold mt-1 text-gray-500">{fileExt}</span>
        </div>
      )}
    </div>
  );
};

const CurrencyDisplay = ({ doc }: { doc: DocumentData }) => {
  if (!doc.originalCurrency || doc.originalCurrency === 'NOK') {
    return (
      <div>
        <p className="text-sm font-medium">{formatAmount(doc.amount)} NOK</p>
        <p className="text-xs text-gray-500">Amount</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium">{formatAmount(doc.amount)} NOK</p>
      <p className="text-xs text-gray-500 text-right">
        Original: {formatAmount(doc.originalAmount)} {doc.originalCurrency}
        <span className="text-xs text-yellow-600 ml-1">
          @ {doc.exchangeRate?.toFixed(2)}
        </span>
      </p>
      <p className="text-xs text-gray-500">Amount</p>
    </div>
  );
};

export function DocumentUpload({ onNext, onPrevious, onUpdate, data }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentData[]>(data?.rows as unknown as DocumentData[] || [])
  const [isUploading, setIsUploading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentData | null>(null)
  const [aiEnabled, setAiEnabled] = useState(data?.aiEnabled ?? false)
  const { toast } = useToast()
  const [previewFileId, setPreviewFileId] = useState<string | undefined>()
  const [attachingBankStatementFor, setAttachingBankStatementFor] = useState<string | null>(null)
  const [isExchangeRateEditable, setIsExchangeRateEditable] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const form = useForm({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      date: "",
      amount: 0,
      description: "",
      exchangeRate: undefined,
    },
  })

  useEffect(() => {
    if (editingDoc) {
      form.reset({
        date: editingDoc.date,
        amount: editingDoc.amount,
        description: editingDoc.description,
        exchangeRate: editingDoc.exchangeRate,
      })
      setIsExchangeRateEditable(false)
    }
  }, [editingDoc, form])

  const processExistingDocuments = useCallback(async () => {
    const updatedDocuments = [...rows];
    setIsUploading(true);

    try {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (!doc.processedByAI) {
          const file = doc.file;
          const form = new FormData();
          form.append('file', file);
          form.append('mimeType', file.type);
          const res = await fetch('/api/process-document', { method: 'POST', body: form });
          if (!res.ok) throw new Error('Failed to process document');
          const result = await res.json();
          
          updatedDocuments[i] = {
            ...doc,
            date: result.date || doc.date,
            amount: result.amount ? Number(result.amount.toFixed(2)) : doc.amount,
            description: result.description || doc.description,
            originalAmount: doc.amount,
            originalCurrency: doc.originalCurrency,
            exchangeRate: result.exchangeRate ? Number(result.exchangeRate.toFixed(4)) : undefined,
            processedByAI: true
          };
        }
      }

      setDocuments(updatedDocuments);
      onUpdate({ documents: updatedDocuments, aiEnabled });
      
      toast({
        title: "Documents Processed",
        description: "All documents have been processed with AI assistance.",
      });
    } catch (error) {
      console.error('Error processing documents:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process some documents with AI.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [documents, onUpdate, toast, aiEnabled]);

  useEffect(() => {
    if (aiEnabled && documents.some(doc => !doc.processedByAI)) {
      processExistingDocuments();
      setHasChanges(true);
    }
  }, [aiEnabled, documents, processExistingDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    try {
      const newDocuments = await Promise.all(acceptedFiles.map(async (file) => {
        const fileId = Math.random().toString(36).substring(7);
        
        let docData: DocumentData = {
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          description: `Expense from ${file.name}`,
          fileId,
          fileName: file.name,
          file,
          processedByAI: false,
        };

        if (aiEnabled) {
          const form = new FormData();
          form.append('file', file);
          form.append('mimeType', file.type);
          const res = await fetch('/api/process-document', { method: 'POST', body: form });
          if (!res.ok) throw new Error('Failed to process document');
          const result = await res.json();
          const amount = Number(result.amount || 0);
          const currency = result.currency || 'NOK';
          
          docData = {
            ...docData,
            date: result.date || docData.date,
            description: result.description || docData.description,
            amount: currency === 'NOK' ? Number(amount.toFixed(2)) : Number((amount * (result.exchangeRate || 1)).toFixed(2)),
            ...(currency !== 'NOK' && {
              originalAmount: Number(amount.toFixed(2)),
              originalCurrency: currency,
              exchangeRate: result.exchangeRate ? Number(result.exchangeRate.toFixed(4)) : undefined
            }),
            processedByAI: true
          };
        }

        return docData;
      }));

      setDocuments(prev => [...prev, ...newDocuments]);
      onUpdate({ documents: [...rows, ...newDocuments], aiEnabled });
      setHasChanges(true);

      toast({
        title: aiEnabled ? "Documents Processed" : "Documents Uploaded",
        description: aiEnabled 
          ? "We've extracted the information from your documents. Please verify the details."
          : "Documents have been uploaded successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error processing documents:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to process the documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [documents, onUpdate, toast, aiEnabled]);

  // Handle bank statement attachment
  const handleAttachBankStatement = (docId: string) => {
    setAttachingBankStatementFor(docId);
  };

  // File dropzone for bank statements
  const onDropBankStatement = useCallback(async (acceptedFiles: File[]) => {
    if (!attachingBankStatementFor || acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      const file = acceptedFiles[0]; // Take just the first file
      const fileId = Math.random().toString(36).substring(7);
      
      const bankStatement = {
        fileId,
        fileName: file.name,
        file,
        date: new Date().toISOString().split('T')[0]
      };
      
      // Add bank statement to the existing document instead of creating a new one
      const updatedDocuments = documents.map(doc => {
        if (doc.fileId === attachingBankStatementFor) {
          return {
            ...doc,
            bankStatement
          };
        }
        return doc;
      });
      
      setDocuments(updatedDocuments);
      onUpdate({ documents: updatedDocuments, aiEnabled });
      
      toast({
        title: "Bank Statement Attached",
        description: "The bank statement has been attached to the expense.",
      });
    } catch (error) {
      console.error('Error attaching bank statement:', error);
      toast({
        title: "Attachment Failed",
        description: "Failed to attach the bank statement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setAttachingBankStatementFor(null);
    }
  }, [attachingBankStatementFor, documents, onUpdate, toast, aiEnabled]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10000000, // 10MB
  })

  const { 
    getRootProps: getBankStatementRootProps, 
    getInputProps: getBankStatementInputProps, 
    isDragActive: isBankStatementDragActive 
  } = useDropzone({
    onDrop: onDropBankStatement,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10000000, // 10MB
    maxFiles: 1
  });

  const handleEditSave = (doc: DocumentData) => {
    const values = form.getValues()
    
    // Calculate the new amount if exchange rate was modified
    let updatedAmount = values.amount
    if (doc.originalCurrency && 
        doc.originalCurrency !== 'NOK' && 
        doc.originalAmount && 
        values.exchangeRate && 
        values.exchangeRate !== doc.exchangeRate) {
      updatedAmount = Number((doc.originalAmount * values.exchangeRate).toFixed(2))
    }
    
    const updatedDoc = { 
      ...doc, 
      date: values.date,
      description: values.description,
      amount: updatedAmount,
      exchangeRate: values.exchangeRate,
    }
    const updatedDocuments = documents.map(d => 
      d.fileId === doc.fileId ? updatedDoc : d
    )
    setDocuments(updatedDocuments)
    onUpdate({ documents: updatedDocuments, aiEnabled })
    setHasChanges(true)
    setEditingDoc(null)
    setIsExchangeRateEditable(false)
    toast({
      title: "Document Updated",
      description: "The document details have been updated successfully.",
    })
  }

  const handleDelete = (fileId: string) => {
    // Check if this is a bank statement fileId
    const docWithBankStatement = documents.find(d => d.bankStatement?.fileId === fileId);
    
    if (docWithBankStatement) {
      // If it's a bank statement, just remove the bank statement from the document
      handleRemoveBankStatement(docWithBankStatement.fileId);
      return;
    }
    
    // Otherwise remove the entire document
    const updatedDocuments = documents.filter(d => d.fileId !== fileId);
    setDocuments(updatedDocuments);
    onUpdate({ documents: updatedDocuments, aiEnabled });
    setHasChanges(true);
    toast({
      title: "Document Removed",
      description: "The document has been removed from your expense claim.",
    });
  };

  const handleRemoveBankStatement = (docId: string) => {
    const updatedDocuments = documents.map(doc => {
      if (doc.fileId === docId && doc.bankStatement) {
        // Create a new object without the bankStatement property
        const { bankStatement, ...docWithoutBankStatement } = doc;
        return docWithoutBankStatement;
      }
      return doc;
    });
    
    setDocuments(updatedDocuments);
    onUpdate({ documents: updatedDocuments, aiEnabled });
    setHasChanges(true);
    toast({
      title: "Bank Statement Removed",
      description: "The bank statement has been removed from the expense.",
    });
  };

  const onSubmit = async () => {
    if (aiEnabled && hasChanges) {
      const descriptions = documents.map(doc => doc.description);
      
      // Update documents and set loading state
      onUpdate({
        documents,
        aiEnabled,
        description: { generatedDescription: null }
      });
      
      try {
        const description = await generateExpenseDescription(descriptions);
        // Update with final data
        onUpdate({
          documents,
          aiEnabled,
          description: { generatedDescription: description }
        });
      } catch (error) {
        console.error('Error generating description:', error);
        toast({
          title: "Description Generation Failed",
          description: "We'll continue without AI-generated description.",
          variant: "destructive",
        });
        onUpdate({ documents, aiEnabled });
      }
    } else {
      onUpdate({ documents, aiEnabled });
    }
    setHasChanges(false);
    onNext();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="relative pb-2">
          <div className="absolute right-6 top-6">
            <AIToggle 
              enabled={aiEnabled}
              onToggle={setAiEnabled}
            />
          </div>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription className="mt-1.5">
            Upload your receipts and supporting documents. 
            {aiEnabled && " We'll automatically extract the information."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 transition-colors",
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-500 hover:bg-blue-50"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center">
              <Upload
                className={cn(
                  "w-12 h-12 mb-4",
                  isDragActive ? "text-blue-500" : "text-gray-400"
                )}
              />
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-gray-600">Processing document...</p>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">
                    {isDragActive
                      ? "Drop your documents here"
                      : "Drag & drop your documents here"}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    or click to select files
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports PDF, JPG, PNG up to 10MB
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {documents.map((doc, index) => (
          <motion.div
            key={doc.fileId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, delay: index * 0.1 }}
          >
            <Card 
              className={cn(
                "relative group cursor-pointer transition-all overflow-hidden border hover:border-blue-100 hover:shadow-md",
                previewFileId === doc.fileId && "ring-2 ring-blue-500",
                previewFileId === doc.bankStatement?.fileId && "ring-2 ring-blue-300"
              )}
              onClick={() => setPreviewFileId(doc.fileId)}
            >
              <CardContent className="p-4">
                <DocumentAlerts 
                  doc={doc} 
                  onAttachBankStatement={handleAttachBankStatement}
                  onPreviewBankStatement={setPreviewFileId}
                  onRemoveBankStatement={handleRemoveBankStatement}
                />
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex items-start gap-3">
                    {doc.file && <DocumentThumbnail file={doc.file} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate max-w-full">{doc.fileName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 mb-1">Document</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                          <Calendar className="w-3 h-3" />
                          <p className="text-xs whitespace-nowrap">{formatDate(doc.date)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 md:mt-0 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md h-full hover:bg-gray-100 transition-colors">
                      <DollarSign className="w-4 h-4 text-blue-400 shrink-0" />
                      <CurrencyDisplay doc={doc} />
                    </div>
                    
                    <div className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded-md h-full hover:bg-gray-100 transition-colors">
                      <FileText className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="w-full">
                        <p className="text-sm line-clamp-2">{doc.description}</p>
                        <p className="text-xs text-gray-500">Description</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 rounded-full border-blue-100 bg-white hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingDoc(doc)
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 h-8 w-8 p-0 rounded-full border-red-100 bg-white hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(doc.fileId)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      <Dialog 
        open={!!editingDoc} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingDoc(null)
            form.reset()
            setIsExchangeRateEditable(false)
          }
        }}
      >
        {editingDoc && (
          <DialogContent className="sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle>Edit Document Details</DialogTitle>
              <DialogDescription>
                Update the extracted information from your document.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {editingDoc.originalCurrency && editingDoc.originalCurrency !== 'NOK' && (
                  <div className="space-y-4 py-2 px-3 rounded-md bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">Exchange Rate</p>
                        <p className="text-xs text-gray-500">
                          1 {editingDoc.originalCurrency} = <span className="font-medium">{editingDoc.exchangeRate?.toFixed(4) || "?"}</span> NOK
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="exchange-rate-toggle" className="text-xs cursor-pointer text-gray-500">
                          Edit
                        </Label>
                        <Switch
                          id="exchange-rate-toggle"
                          checked={isExchangeRateEditable}
                          onCheckedChange={setIsExchangeRateEditable}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="exchangeRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.0001"
                                disabled={!isExchangeRateEditable}
                                className={!isExchangeRateEditable ? "opacity-60" : ""}
                                {...field}
                                onChange={e => {
                                  const value = parseFloat(e.target.value);
                                  field.onChange(value);
                                }}
                                value={field.value || ''}
                              />
                              <span className="text-sm font-medium">NOK</span>
                            </div>
                          </FormControl>
                          {isExchangeRateEditable && (
                            <p className="text-xs text-amber-600 mt-1">
                              * Modifying the exchange rate will update the NOK amount
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingDoc(null)
                      setIsExchangeRateEditable(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleEditSave(editingDoc)}
                    className="bg-linear-to-r from-blue-500 to-indigo-500 text-white px-8"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog 
        open={!!attachingBankStatementFor} 
        onOpenChange={(open) => {
          if (!open) {
            setAttachingBankStatementFor(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Attach Bank Statement</DialogTitle>
            <DialogDescription>
              Upload a bank statement showing the transaction for this expense.
            </DialogDescription>
          </DialogHeader>
          
          <div
            {...getBankStatementRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 mt-4 transition-colors",
              isBankStatementDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-500 hover:bg-blue-50"
            )}
          >
            <input {...getBankStatementInputProps()} />
            <div className="flex flex-col items-center justify-center text-center">
              <Upload
                className={cn(
                  "w-10 h-10 mb-3",
                  isBankStatementDragActive ? "text-blue-500" : "text-gray-400"
                )}
              />
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-gray-600">Processing bank statement...</p>
                </div>
              ) : (
                <>
                  <p className="text-base font-medium mb-2">
                    {isBankStatementDragActive
                      ? "Drop your bank statement here"
                      : "Drag & drop your bank statement here"}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    or click to select file
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports PDF, JPG, PNG up to 10MB
                  </p>
                </>
              )}
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            <p className="flex items-center gap-1 mt-2">
              <AlertCircle className="h-3 w-3" />
              Only upload bank statements that correspond to this foreign currency transaction.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          onClick={onSubmit}
          className="bg-linear-to-r from-blue-500 to-indigo-500 text-white px-8"
          disabled={documents.length === 0}
        >
          Continue
        </Button>
      </div>

      <AnimatePresence>
        {previewFileId && (
          <FilePreview
            files={[
              ...rows,
              ...rows
                .filter(doc => doc.bankStatement)
                .map(doc => ({
                  fileId: doc.bankStatement!.fileId,
                  fileName: `Bank Statement: ${doc.bankStatement!.fileName}`,
                  file: doc.bankStatement!.file
                }))
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
