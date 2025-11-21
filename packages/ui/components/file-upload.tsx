"use client"

import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import Image from "next/image"

export function FileUpload({
    onChange,
    name,
    value
}: {
    onChange: (file: File | null) => void
    name?: string
    value?: File | string | null
}) {
  const previewUrl = value instanceof File ? URL.createObjectURL(value) : (typeof value === "string" ? value : null);
  
  return (
    <div className="flex justify-center">
      <div className="grid w-full max-w-sm items-center gap-3">
        <Label htmlFor={name}>{name}</Label>
        <Input id={name} type="file" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        {previewUrl && (
          <Image
            src={previewUrl}
            alt={name ?? "Uploaded image"}
            width={200}
            height={200}
            className="rounded-md object-cover"
          />
        )}
      </div>
    </div>
  )
}