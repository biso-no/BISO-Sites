"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import Image from "next/image";

export function FileUpload({
  onChange,
  name,
  value,
}: {
  onChange: (file: File | null) => void;
  name?: string;
  value?: File | string | null;
}) {
  const previewUrl =
    value instanceof File
      ? URL.createObjectURL(value)
      : typeof value === "string"
        ? value
        : null;

  return (
    <div className="flex justify-center">
      <div className="grid w-full max-w-sm items-center gap-3">
        <Label htmlFor={name}>{name}</Label>
        <Input
          id={name}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          type="file"
        />
        {previewUrl && (
          <Image
            alt={name ?? "Uploaded image"}
            className="rounded-md object-cover"
            height={200}
            src={previewUrl}
            width={200}
          />
        )}
      </div>
    </div>
  );
}
