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

type HeroUploadPreviewProps = {
  heroUrl?: string;
  onChange: (url: string) => void;
  departmentName: string;
};

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
    if (!file) {
      return;
    }

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
    <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
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
          accept="image/*"
          className="hidden"
          disabled={isUploading}
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />

        {/* Hero Preview */}
        <div className="group relative flex aspect-16/5 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-border/50 bg-linear-to-br from-primary/20 to-accent/20">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">
                Uploading hero image...
              </p>
            </div>
          ) : (
            <>
              <Image
                alt={`${departmentName} hero background`}
                className="object-cover"
                fill
                src={displayUrl}
              />
              {!hasCustomHero && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="rounded bg-black/60 px-2 py-1 text-white text-xs backdrop-blur-sm">
                    Default Background
                  </span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all duration-300 group-hover:bg-black/60">
                <Button
                  className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  variant="secondary"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {hasCustomHero ? "Change" : "Upload Custom"}
                </Button>
                {hasCustomHero && (
                  <Button
                    className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    disabled={isUploading}
                    onClick={handleClear}
                    size="sm"
                    variant="destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reset to Default
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* URL Input (alternative method) */}
        {isEditingUrl && (
          <div className="fade-in-50 slide-in-from-top-2 animate-in space-y-3">
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="hero-url">
                Or paste hero image URL
              </Label>
              <Input
                className="h-9 bg-card/60 text-sm backdrop-blur-sm"
                id="hero-url"
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/hero.jpg"
                type="url"
                value={urlInput}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!urlInput}
                onClick={handleUrlSave}
                size="sm"
              >
                Save URL
              </Button>
              <Button
                onClick={() => {
                  setUrlInput(heroUrl || "");
                  setIsEditingUrl(false);
                }}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!(isUploading || isEditingUrl) && (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              {hasCustomHero ? "Upload New" : "Upload Custom Hero"}
            </Button>
            <Button
              onClick={() => setIsEditingUrl(true)}
              size="sm"
              variant="ghost"
            >
              Or use URL
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
