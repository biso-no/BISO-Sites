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
import { uploadDepartmentLogo } from "@/lib/actions/departments";

type LogoUploadPreviewProps = {
  logoUrl?: string;
  onChange: (url: string) => void;
  departmentName: string;
};

export function LogoUploadPreview({
  logoUrl,
  onChange,
  departmentName,
}: LogoUploadPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(logoUrl || "");

  const handleFileUpload = async (file: File) => {
    if (!file) {
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadDepartmentLogo(formData);
      onChange(result.url);
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Failed to upload logo", error);
      toast.error("Failed to upload logo");
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
    toast.success("Logo URL updated");
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    setIsEditingUrl(false);
    toast.info("Logo removed");
  };

  const initials = departmentName.substring(0, 2).toUpperCase();

  const renderPreview = () => {
    if (isUploading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Uploading...</p>
        </div>
      );
    }

    if (logoUrl) {
      return (
        <>
          <Image
            alt={departmentName}
            className="object-cover"
            fill
            src={logoUrl}
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all duration-300 group-hover:bg-black/60">
            <Button
              className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="secondary"
            >
              <Upload className="mr-2 h-4 w-4" />
              Change
            </Button>
            <Button
              className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              disabled={isUploading}
              onClick={handleClear}
              size="sm"
              variant="destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10">
          <span className="font-bold text-3xl text-primary">{initials}</span>
        </div>
        <p className="text-muted-foreground text-sm">No logo uploaded</p>
        <div className="flex gap-2">
          <Button
            className="bg-card/60 backdrop-blur-sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
          <Button
            disabled={isUploading}
            onClick={() => setIsEditingUrl(true)}
            size="sm"
            variant="ghost"
          >
            Or use URL
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" />
          Department Logo
        </CardTitle>
        <CardDescription className="text-xs">
          Upload or link logo image (recommended: 256x256px, square format)
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

        {/* Logo Preview */}
        <div className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-border/50 bg-linear-to-br from-primary/20 to-accent/20">
          {renderPreview()}
        </div>

        {/* URL Input (alternative method) */}
        {isEditingUrl && !logoUrl && (
          <div className="fade-in-50 slide-in-from-top-2 animate-in space-y-3">
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="logo-url">
                Or paste logo URL
              </Label>
              <Input
                className="h-9 bg-card/60 text-sm backdrop-blur-sm"
                id="logo-url"
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://example.com/logo.png"
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
                  setUrlInput("");
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

        {/* Action buttons when logo exists */}
        {logoUrl && !isUploading && (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload New
            </Button>
            <Button
              onClick={() => {
                setUrlInput(logoUrl);
                setIsEditingUrl(true);
              }}
              size="sm"
              variant="ghost"
            >
              Edit URL
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
