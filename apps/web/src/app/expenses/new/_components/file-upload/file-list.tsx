"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, File } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { Progress } from "@repo/ui/components/ui/progress"

interface FileListProps {
  files: File[]
  maxFiles: number
  onRemove: (name: string) => void
}

export function FileList({ files, maxFiles, onRemove }: FileListProps) {
  if (files.length === 0) return null

  return (
    <AnimatePresence>
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
                <p className="text-sm font-medium text-gray-700">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(file.name)}
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
    </AnimatePresence>
  )
} 