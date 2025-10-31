"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { UploadZone } from "./upload-zone"
import { FileList } from "./file-list"
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert"
import { AlertCircle } from "lucide-react"

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
      <UploadZone
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        maxSize={maxSize}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FileList
        files={files}
        maxFiles={maxFiles}
        onRemove={removeFile}
      />
    </div>
  )
} 