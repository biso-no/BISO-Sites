"use client"

import { useMemo, useRef, useTransition } from "react"
import Image from "next/image"
import { Upload, Trash2, Loader2, Star } from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { uploadProductImage } from "@/app/actions/products"
import { cn } from "@/lib/utils"

interface ProductImagesProps {
  images: string[]
  onChange: (next: string[]) => void
}

export default function ImageUploadCard({ images = [], onChange }: ProductImagesProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()

  const validImages = useMemo(
    () =>
      (images || [])
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0),
    [images]
  )

  const mainImage = validImages[0] || ""
  const thumbnails = validImages.slice(1)

  const handleUpload = (file: File) => {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      try {
        const result = await uploadProductImage(formData)
        onChange([...validImages, result.url])
        toast.success("Image uploaded")
      } catch (error) {
        console.error("Failed to upload image", error)
        toast.error("Failed to upload image")
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    })
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const removeImage = (index: number) => {
    const next = [...validImages]
    next.splice(index, 1)
    onChange(next)
    toast.info("Image removed")
  }

  const makeCover = (index: number) => {
    if (index === 0) return
    const next = [...validImages]
    const [selected] = next.splice(index, 1)
    next.unshift(selected)
    onChange(next)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Product Images</CardTitle>
        <CardDescription>
          Upload and manage your product gallery. The first image is used as the cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="relative aspect-[4/5] w-full max-h-60 overflow-hidden rounded-md border bg-muted">
          {mainImage ? (
            <Image
              alt="Main product image"
              className="object-cover"
              fill
              src={mainImage}
              sizes="400px"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
              <Upload className="h-5 w-5" />
              No image selected
            </div>
          )}
          {mainImage ? (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-xs text-primary-foreground">
              <Star className="h-3 w-3" />
              Cover
            </div>
          ) : null}
          {mainImage ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 bg-background/80"
              type="button"
              onClick={() => removeImage(0)}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove cover image</span>
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {thumbnails.map((img, index) => (
            <div key={img} className="relative">
              <button
                type="button"
                onClick={() => makeCover(index + 1)}
                className={cn(
                  "group aspect-square w-full overflow-hidden rounded-md border",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              >
                <Image
                  alt={`Product image ${index + 2}`}
                  className="h-full w-full object-cover transition group-hover:opacity-80"
                  fill
                  sizes="120px"
                  src={img}
                />
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 bg-background/80"
                type="button"
                onClick={() => removeImage(index + 1)}
                disabled={isPending}
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          ))}
          {[...Array(Math.max(0, 3 - thumbnails.length))].map((_, index) => (
            <button
              key={`empty-${index}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Add
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload image
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([])}
            disabled={isPending || validImages.length === 0}
          >
            Clear all
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
