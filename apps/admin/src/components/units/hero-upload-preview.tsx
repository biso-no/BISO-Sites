"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadDepartmentHero } from "@/lib/actions/departments";

interface HeroUploadPreviewProps {
  heroUrl?: string;
  onChange: (url: string) => void;
  departmentName: string;
}

const DEFAULT_HERO_URL =
  "https://appwrite.biso.no/v1/storage/buckets/content/files/hero_bg/view?project=biso";

export function HeroUploadPreview({
  heroUrl,
  onChange,
  departmentName,
}: HeroUploadPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(heroUrl || "");

  const displayUrl = heroUrl || DEFAULT_HERO_URL;
  const hasCustomHero = !!heroUrl;

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadDepartmentHero(formData);
      onChange(result.url);
      toast.success("Hero image uploaded successfully");
    } catch (error) {
      console.error("Failed to upload hero image", error);
      toast.error("Failed to upload hero image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUrlSave = () => {
    onChange(urlInput);
    setIsEditingUrl(false);
    toast.success("Hero URL updated");
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    setIsEditingUrl(false);
    toast.info("Hero image reset to default");
  };

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Hero Background
        </CardTitle>
        <CardDescription className="text-xs">
          Upload hero background image (recommended: 1920x600px, landscape
          format)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
          disabled={isUploading}
        />

        {/* Hero Preview */}
        <div className="aspect-16/5 w-full rounded-xl overflow-hidden bg-linear-to-br from-primary/20 to-accent/20 border-2 border-border/50 flex items-center justify-center relative group">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Uploading hero image...
              </p>
            </div>
          ) : (
            <>
              <Image
                src={displayUrl}
                alt={`${departmentName} hero background`}
                fill
                className="object-cover"
              />
              {!hasCustomHero && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="text-xs bg-black/60 text-white px-2 py-1 rounded backdrop-blur-sm">
                    Default Background
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {hasCustomHero ? "Change" : "Upload Custom"}
                </Button>
                {hasCustomHero && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClear}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* URL Input (alternative method) */}
        {isEditingUrl && (
          <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-2">
            <div className="space-y-2">
              <Label htmlFor="hero-url" className="text-xs">
                Or paste hero image URL
              </Label>
              <Input
                id="hero-url"
                type="url"
                placeholder="https://example.com/hero.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="h-9 text-sm bg-card/60 backdrop-blur-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUrlSave}
                className="flex-1"
                disabled={!urlInput}
              >
                Save URL
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUrlInput(heroUrl || "");
                  setIsEditingUrl(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isUploading && !isEditingUrl && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {hasCustomHero ? "Upload New" : "Upload Custom Hero"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingUrl(true)}
            >
              Or use URL
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
