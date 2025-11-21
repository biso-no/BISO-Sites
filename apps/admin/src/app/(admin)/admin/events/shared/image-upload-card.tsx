"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { uploadEventImage } from "@/app/actions/events";
import { toast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

type EventImagesProps = {
  images: string[];
  onChange: (next: string[]) => void;
};

export default function ImageUploadCard({
  images = [],
  onChange,
}: EventImagesProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  const validImages = useMemo(
    () =>
      (images || [])
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0),
    [images]
  );

  const mainImage = validImages[0] || "";
  const thumbnails = validImages.slice(1);

  const handleUpload = async (file: File) => {
    if (!file) {
      return;
    }

    const fileId = `${file.name}-${Date.now()}`;
    setUploadingFiles((prev) => new Set([...prev, fileId]));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadEventImage(formData);
      const url = `https://appwrite.biso.no/v1/storage/buckets/content/files/${result.id}/view?project=biso`;
      onChange([...validImages, url]);
      toast({ title: "Image uploaded" });
    } catch (error) {
      console.error("Failed to upload image", error);
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (file) {
        handleUpload(file);
      }
    }
  };

  const removeImage = (index: number) => {
    const next = [...validImages];
    next.splice(index, 1);
    onChange(next);
    toast({ title: "Image removed" });
  };

  const makeCover = (index: number) => {
    if (index === 0) {
      return;
    }
    const next = [...validImages];
    const [selected] = next.splice(index, 1);
    if (!selected) {
      return;
    }
    next.unshift(selected);
    onChange(next);
  };

  const isUploading = uploadingFiles.size > 0;
  const uploadingArray = Array.from(uploadingFiles);
  const placeholderSlots = ["first", "second", "third"] as const;
  const availablePlaceholderSlots = placeholderSlots.slice(
    0,
    Math.max(0, 3 - thumbnails.length)
  );

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader>
        <CardTitle>Event Images</CardTitle>
        <CardDescription>
          Upload and manage event images. The first image is used as the cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />
        <div className="relative aspect-4/5 max-h-60 w-full overflow-hidden rounded-md border bg-muted">
          {mainImage ? (
            <Image
              alt="Main event image"
              className="object-cover"
              fill
              sizes="400px"
              src={mainImage}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground text-xs">
              <Upload className="h-5 w-5" />
              No image selected
            </div>
          )}
          {mainImage ? (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-primary-foreground text-xs">
              <Star className="h-3 w-3" />
              Cover
            </div>
          ) : null}
          {mainImage ? (
            <Button
              className="absolute top-2 right-2 bg-background/80"
              disabled={isUploading}
              onClick={() => removeImage(0)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove cover image</span>
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {thumbnails.map((img, index) => (
            <div className="relative" key={img}>
              <button
                className={cn(
                  "group aspect-square w-full overflow-hidden rounded-md border",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
                onClick={() => makeCover(index + 1)}
                type="button"
              >
                <Image
                  alt={`Event image ${index + 2}`}
                  className="h-full w-full object-cover transition group-hover:opacity-80"
                  fill
                  sizes="120px"
                  src={img}
                />
              </button>
              <Button
                className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                disabled={isUploading}
                onClick={() => removeImage(index + 1)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          ))}
          {availablePlaceholderSlots.map((slot, index) => {
            const isThisTileLoading = index < uploadingArray.length;
            return (
              <button
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                disabled={isUploading}
                key={`placeholder-${slot}`}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {isThisTileLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Add
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading {uploadingFiles.size} image
                {uploadingFiles.size > 1 ? "s" : ""}...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload image
              </>
            )}
          </Button>
          <Button
            disabled={isUploading || validImages.length === 0}
            onClick={() => onChange([])}
            type="button"
            variant="outline"
          >
            Clear all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
