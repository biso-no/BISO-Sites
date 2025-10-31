"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"

interface FilePreviewProps {
  files: Array<{
    fileId: string
    file?: File
    fileName: string
  }>
  currentFileId?: string
  onClose: () => void
  onFileChange?: (fileId: string) => void
  className?: string
}

export function FilePreview({ 
  files, 
  currentFileId, 
  onClose, 
  onFileChange,
  className = "" 
}: FilePreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const currentIndex = files.findIndex(f => f.fileId === currentFileId)
  
  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      onFileChange?.(files[currentIndex + 1].fileId)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onFileChange?.(files[currentIndex - 1].fileId)
    }
  }

  if (!currentFileId) return null

  const currentFile = files.find(f => f.fileId === currentFileId)
  if (!currentFile) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      className={`fixed inset-y-0 right-0 w-1/2 bg-white shadow-xl z-50 flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">{currentFile.fileName}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gray-100">
        {currentFile.file && (
          <iframe
            src={URL.createObjectURL(currentFile.file)}
            className="w-full h-full"
            onLoad={() => setIsLoading(false)}
          />
        )}
        
        {/* Navigation buttons */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="h-12 w-12 rounded-full bg-white/80 shadow-lg ml-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === files.length - 1}
            className="h-12 w-12 rounded-full bg-white/80 shadow-lg mr-4"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* File counter */}
      <div className="p-4 border-t text-center text-sm text-gray-500">
        {currentIndex + 1} of {files.length}
      </div>
    </motion.div>
  )
} 