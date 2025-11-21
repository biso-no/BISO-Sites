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

interface EventImagesProps {
  images: string[];
  onChange: (next: string[]) => void;
}

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
    if (!file) return;

    const fileId = `${file.name}-${Date.now()}`;
    setUploadingFiles((prev) => new Set([...prev, fileId]));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadEventImage(formData);
      const url = `https://appwrite.biso.no/v1/storage/buckets/content/files/${result.$id}/view?project=biso`;
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
    files.forEach((file) => {
      if (file) {
        handleUpload(file);
      }
    });
  };

  const removeImage = (index: number) => {
    const next = [...validImages];
    next.splice(index, 1);
    onChange(next);
    toast({ title: "Image removed" });
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    const next = [...validImages];
    const [selected] = next.splice(index, 1);
    if (!selected) return;
    next.unshift(selected);
    onChange(next);
  };

  const isUploading = uploadingFiles.size > 0;
  const uploadingArray = Array.from(uploadingFiles);

  return (
    <Card className="overflow-hidden glass-card">
      <CardHeader>
        <CardTitle>Event Images</CardTitle>
        <CardDescription>
          Upload and manage event images. The first image is used as the cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
        <div className="relative aspect-4/5 w-full max-h-60 overflow-hidden rounded-md border bg-muted">
          {mainImage ? (
            <Image
              alt="Main event image"
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
              disabled={isUploading}
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
                  alt={`Event image ${index + 2}`}
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
                disabled={isUploading}
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          ))}
          {[...Array(Math.max(0, 3 - thumbnails.length))].map((_, index) => {
            const isThisTileLoading = index < uploadingArray.length;
            return (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                disabled={isUploading}
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
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
            type="button"
            variant="outline"
            onClick={() => onChange([])}
            disabled={isUploading || validImages.length === 0}
          >
            Clear all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
