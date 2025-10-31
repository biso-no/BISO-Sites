"use client"

import { Upload } from "lucide-react"
import { DropzoneInputProps, DropzoneRootProps } from "react-dropzone"

interface UploadZoneProps {
  getRootProps: (props?: any) => DropzoneRootProps
  getInputProps: (props?: any) => DropzoneInputProps
  isDragActive: boolean
  maxSize: number
}

export function UploadZone({
  getRootProps,
  getInputProps,
  isDragActive,
  maxSize,
}: UploadZoneProps) {
  return (
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
        <Upload 
          className={`w-10 h-10 ${
            isDragActive ? "text-blue-500" : "text-gray-400"
          }`}
        />
        {isDragActive ? (
          <p className="text-blue-500 font-medium">
            Drop files here...
          </p>
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
  )
} 