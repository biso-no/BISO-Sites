"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Upload, Link as LinkIcon, X } from "lucide-react";
import { getStorageFileUrl } from "@repo/api/storage";
import type { ImageData } from "../types";

export interface ImageUploadProps {
  value?: ImageData;
  onChange: (value: ImageData) => void;
  label?: string;
}

/**
 * Image upload component for Puck editor
 * Supports both URL input and file upload to Appwrite storage
 */
export function ImageUpload({ value, onChange, label = "Image" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlChange = (url: string) => {
    onChange({
      type: "url",
      url,
      alt: value?.alt || "",
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload to Appwrite storage
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { fileId } = await response.json();

      onChange({
        type: "upload",
        fileId,
        url: getStorageFileUrl("content", fileId),
        alt: value?.alt || file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAltChange = (alt: string) => {
    if (value) {
      onChange({ ...value, alt });
    }
  };

  const handleRemove = () => {
    onChange({
      type: "url",
      url: "",
      alt: "",
    });
  };

  const imageUrl = value?.type === "upload" && value.fileId
    ? getStorageFileUrl("content", value.fileId)
    : value?.url;

  return (
    <div className="space-y-4">
      <Label>{label}</Label>

      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">
            <LinkIcon className="w-4 h-4 mr-2" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-2">
          <Input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={value?.type === "url" ? value.url : ""}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
        </TabsContent>

        <TabsContent value="upload" className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              disabled={uploading}
            />
            {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </TabsContent>
      </Tabs>

      {imageUrl && (
        <div className="space-y-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <img
              src={imageUrl}
              alt={value?.alt || "Preview"}
              className="h-full w-full object-cover"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div>
            <Label htmlFor="alt-text">Alt Text</Label>
            <Input
              id="alt-text"
              type="text"
              placeholder="Describe the image"
              value={value?.alt || ""}
              onChange={(e) => handleAltChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

