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

interface LogoUploadPreviewProps {
  logoUrl?: string;
  onChange: (url: string) => void;
  departmentName: string;
}

export function LogoUploadPreview({ logoUrl, onChange, departmentName }: LogoUploadPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(logoUrl || "");

  const handleFileUpload = async (file: File) => {
    if (!file) return;

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

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Department Logo
        </CardTitle>
        <CardDescription className="text-xs">
          Upload or link logo image (recommended: 256x256px, square format)
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

        {/* Logo Preview */}
        <div className="aspect-square w-full rounded-xl overflow-hidden bg-linear-to-br from-primary/20 to-accent/20 border-2 border-border/50 flex items-center justify-center relative group">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : logoUrl ? (
            <>
              <Image src={logoUrl} alt={departmentName} fill className="object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleClear}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <span className="text-3xl font-bold text-primary">{initials}</span>
              </div>
              <p className="text-sm text-muted-foreground">No logo uploaded</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-card/60 backdrop-blur-sm"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingUrl(true)}
                  disabled={isUploading}
                >
                  Or use URL
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* URL Input (alternative method) */}
        {isEditingUrl && !logoUrl && (
          <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-2">
            <div className="space-y-2">
              <Label htmlFor="logo-url" className="text-xs">
                Or paste logo URL
              </Label>
              <Input
                id="logo-url"
                type="url"
                placeholder="https://example.com/logo.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="h-9 text-sm bg-card/60 backdrop-blur-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUrlSave} className="flex-1" disabled={!urlInput}>
                Save URL
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUrlInput("");
                  setIsEditingUrl(false);
                }}
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
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload New
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setUrlInput(logoUrl);
                setIsEditingUrl(true);
              }}
            >
              Edit URL
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
