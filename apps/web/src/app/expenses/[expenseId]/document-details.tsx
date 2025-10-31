"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Progress } from "@repo/ui/components/ui/progress";
import {
  Upload,
  FileText,
  Calendar,
  DollarSign,
  Edit2,
  Loader2,
  X,
  Plus,
  AlertCircle,
  Check,
} from "lucide-react";
import { useFormContext } from "./formContext";
import { useDropzone } from "react-dropzone";
import { format } from "date-fns";
import { cn } from '@repo/ui/lib/utils';
import Image from "next/image";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export function DocumentUploadStep() {
  const { updateFormData, formData, nextStep, prevStep } = useFormContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      setIsProcessing(true);
      try {
        // Create preview URL
        const preview = URL.createObjectURL(file);
        
        // Upload to your server and process with OCR/AI
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/process-receipt", {
          method: "POST",
          body: formData,
        });
        
        const result = await response.json();
        
        // Add new document with AI-extracted data
        const newDoc = {
          id: Date.now(),
          file,
          amount: result.amount || 0,
          date: result.date || new Date(),
          description: result.description || "",
          isProcessed: true,
          confidence: result.confidence || 1,
        };

        setDocuments(prev => [...prev, newDoc]);
        setTotalAmount(prev => prev + (result.amount || 0));
        
      } catch (error) {
        console.error("Error processing document:", error);
        // Add document with empty data for manual input
        const newDoc = {
          id: Date.now(),
          file,
          amount: 0,
          date: new Date(),
          description: "",
          isProcessed: false,
          confidence: 0,
        };
        setDocuments(prev => [...prev, newDoc]);
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleEdit = (doc) => {
    setEditingDoc(doc);
  };

  const handleSave = (docId, updatedData) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        return { ...doc, ...updatedData, isEdited: true };
      }
      return doc;
    }));
    setEditingDoc(null);
    
    // Update total amount
    const newTotal = documents.reduce((sum, doc) => sum + doc.amount, 0);
    setTotalAmount(newTotal);
  };

  const handleDelete = (docId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
    // Update total amount
    const newTotal = documents.reduce((sum, doc) => sum + (doc.id !== docId ? doc.amount : 0), 0);
    setTotalAmount(newTotal);
  };

  const handleSubmit = () => {
    updateFormData({
      expense_attachments: documents,
      total: totalAmount
    });
    nextStep();
  };

  return (
    <div className="space-y-6">
      <Progress value={75} className="w-full" />
      
      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeInUp}
        className="space-y-6"
      >
        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents
              </span>
              <span className="text-sm font-normal text-gray-500">
                Total: {totalAmount.toFixed(2)} NOK
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 transition-colors duration-200 ease-in-out relative",
                isDragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50",
                isProcessing && "pointer-events-none opacity-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center text-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-gray-500">Processing documents...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600">
                      Drag and drop your documents here or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Supported formats: JPEG, PNG, PDF
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document List */}
        <AnimatePresence mode="popLayout">
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <Card className="relative overflow-hidden">
                {doc.confidence < 0.8 && !doc.isEdited && (
                  <div className="absolute top-0 right-0 m-4">
                    <div className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Please verify details
                    </div>
                  </div>
                )}
                
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Document Preview */}
                    <div className="w-32 h-32 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                      {doc.preview ? (
                        <Image 
                          src={doc.preview} 
                          alt="Document preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-8 w-8 text-gray-400" />
                      )}
                    </div>

                    {/* Document Details */}
                    <div className="flex-1 space-y-4">
                      {editingDoc?.id === doc.id ? (
                        <div className="space-y-4">
                          <Input
                            defaultValue={doc.description}
                            placeholder="Description"
                            onChange={(e) => handleSave(doc.id, { description: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              type="number"
                              defaultValue={doc.amount}
                              placeholder="Amount"
                              onChange={(e) => handleSave(doc.id, { amount: parseFloat(e.target.value) })}
                            />
                            <Input
                              type="date"
                              defaultValue={format(doc.date, "yyyy-MM-dd")}
                              onChange={(e) => handleSave(doc.id, { date: new Date(e.target.value) })}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <h3 className="font-medium">{doc.description || "No description"}</h3>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(doc)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(doc.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              {doc.amount.toFixed(2)} NOK
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {format(doc.date, "PP")}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={documents.length === 0 || isProcessing}
          >
            Continue
          </Button>
        </div>
      </motion.div>
    </div>
  );
}