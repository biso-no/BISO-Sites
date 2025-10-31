"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { motion, AnimatePresence } from "framer-motion"
import { X, Upload, File, AlertCircle } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { Progress } from "@repo/ui/components/ui/progress"
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert"

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
  maxSize?: number
  accept?: Record<string, string[]>
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024,
  accept = {
    "image/*": [".png", ".jpg", ".jpeg"],
    "application/pdf": [".pdf"],
  },
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>("")

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.filter(
        file => !files.find(f => f.name === file.name)
      )

      if (files.length + newFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`)
        return
      }

      const updatedFiles = [...files, ...newFiles]
      setFiles(updatedFiles)
      onFilesSelected(updatedFiles)
      setError("")
    },
    [files, maxFiles, onFilesSelected]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
  })

  const removeFile = (name: string) => {
    const updatedFiles = files.filter(file => file.name !== name)
    setFiles(updatedFiles)
    onFilesSelected(updatedFiles)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8
          transition-colors duration-200 cursor-pointer
          ${isDragActive 
            ? "border-blue-500 bg-blue-50/50" 
            : "border-gray-300 hover:border-gray-400"
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <Upload className={`w-10 h-10 ${isDragActive ? "text-blue-500" : "text-gray-400"}`} />
          {isDragActive ? (
            <p className="text-blue-500 font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-600">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supported formats: PNG, JPG, PDF (max {maxSize / 1024 / 1024}MB)
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {files.map((file) => (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
            
            <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
              <span>
                {files.length} of {maxFiles} files
              </span>
              <Progress 
                value={(files.length / maxFiles) * 100}
                className="w-32"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 