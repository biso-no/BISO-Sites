"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import Image from "next/image";
import { useEffect, useState } from "react";

export type FileUploadProps = {
  onChange: (value: File | string | null) => void;
  name?: string;
  value?: File | string | null;
  getImages?: () => Promise<Array<{ id: string; name: string; url: string }>>;
};

export function FileUpload({
  onChange,
  name,
  value,
  getImages,
}: FileUploadProps) {
  const [images, setImages] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  let previewUrl: string | null = null;

  if (value instanceof File) {
    previewUrl = URL.createObjectURL(value);
  } else if (typeof value === "string") {
    previewUrl = value;
  }

  useEffect(() => {
    if (getImages) {
      setLoading(true);
      getImages()
        .then(setImages)
        .catch((err) => {
          console.error("Failed to fetch images", err);
          setImages([]);
        })
        .finally(() => setLoading(false));
    }
  }, [getImages]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs className="w-full" defaultValue="upload">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent className="flex flex-col gap-4" value="upload">
          <div className="grid w-full max-w-sm items-center gap-3">
            <Label htmlFor={name}>{name}</Label>
            <Input
              id={name}
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
              type="file"
            />
          </div>
        </TabsContent>
        <TabsContent value="library">
          <div className="grid max-h-[300px] grid-cols-3 gap-2 overflow-y-auto rounded-md border p-2">
            {loading ? (
              <div className="col-span-3 py-4 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : images.length === 0 ? (
              <div className="col-span-3 py-4 text-center text-muted-foreground text-sm">
                No images found
              </div>
            ) : (
              images.map((image) => (
                <button
                  key={image.id}
                  className="relative aspect-square w-full overflow-hidden rounded-md border hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={() => onChange(image.url)}
                  type="button"
                >
                  <Image
                    alt={image.name}
                    className="object-cover"
                    fill
                    src={image.url}
                  />
                </button>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {previewUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
          <Image
            alt={name ?? "Selected image"}
            className="object-contain"
            fill
            src={previewUrl}
          />
        </div>
      )}
    </div>
  );
}
