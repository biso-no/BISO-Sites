"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ImageIcon, Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadEventImage } from "@/app/actions/events";
import { toast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

type CoverImageUploadProps = {
  /** Ordered list of image URLs. First is the cover. */
  images: string[];
  onChange: (next: string[]) => void;
  /** Optional label override shown above the drop zone */
  label?: string;
};

export function CoverImageUpload({
  images = [],
  onChange,
  label = "Cover image",
}: CoverImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const validImages = images.filter((s) => typeof s === "string" && s.trim().length > 0);
  const cover = validImages[0] ?? null;
  const extras = validImages.slice(1);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files are accepted", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadEventImage(fd);
      onChange([...validImages, result.url]);
    } catch {
      toast({ title: "Upload failed — please try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      uploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const next = [...validImages];
    next.splice(index, 1);
    onChange(next);
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    const next = [...validImages];
    const [picked] = next.splice(index, 1);
    if (picked) next.unshift(picked);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">{label}</p>

      {/* Drop zone / cover preview */}
      <div
        className={cn(
          "relative flex min-h-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : cover
              ? "border-border/40"
              : "border-border hover:border-primary/40 hover:bg-muted/40",
        )}
        onClick={() => !cover && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={cover ? "Cover image" : "Click or drag an image to upload"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        {cover ? (
          <>
            <Image
              src={cover}
              alt="Cover"
              fill
              className="object-cover"
              sizes="600px"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            {/* Cover badge */}
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-primary-foreground text-xs font-medium">
              <Star className="h-3 w-3" />
              Cover
            </span>

            {/* Remove button */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 bg-background/70 hover:bg-background/90"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(0);
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove cover image</span>
            </Button>

            {/* Replace button */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 text-xs hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="mr-1.5 h-3 w-3" />
              Replace
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {uploading ? "Uploading…" : "Drop an image here"}
              </p>
              {!uploading && (
                <p className="text-xs">or click to browse your files</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Additional images */}
      {extras.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {extras.map((img, i) => (
            <div key={img} className="relative aspect-square">
              <Image
                src={img}
                alt={`Image ${i + 2}`}
                fill
                className="rounded-lg object-cover"
                sizes="120px"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/0 opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 bg-background/80 hover:bg-background"
                  onClick={() => makeCover(i + 1)}
                  title="Set as cover"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 bg-background/80 hover:bg-background"
                  onClick={() => removeImage(i + 1)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground text-xs transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Add
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
