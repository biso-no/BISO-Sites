"use client";

import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export type LinkPickerProps = {
  value: string;
  onChange: (value: string) => void;
  getPages: () => Promise<{ label: string; value: string }[]>;
};

export function LinkPicker({
  value = "",
  onChange,
  getPages,
}: LinkPickerProps) {
  const [mode, setMode] = useState<"internal" | "external">("external");
  const [pages, setPages] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPages = async () => {
      setLoading(true);
      try {
        const fetchedPages = await getPages();
        setPages(fetchedPages);

        // Determine initial mode based on value
        // If value matches one of the page values, it's internal
        // Otherwise it's external (or empty)
        if (fetchedPages.some((p) => p.value === value)) {
          setMode("internal");
        } else {
          setMode("external");
        }
      } catch (error) {
        console.error("Failed to load pages", error);
      } finally {
        setLoading(false);
      }
    };

    loadPages();
  }, [getPages, value]);

  // Handle mode switch
  const handleModeChange = (newMode: string) => {
    setMode(newMode as "internal" | "external");
    // When switching modes, we might want to clear the value or keep it?
    // Keeping it is safer, but might be confusing if switching from a valid URL to internal selector where it's not a match.
    // For now, let's keep it simple.
  };

  return (
    <div className="grid gap-2">
      <Tabs className="w-full" onValueChange={handleModeChange} value={mode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="internal">Internal Page</TabsTrigger>
          <TabsTrigger value="external">External URL</TabsTrigger>
        </TabsList>
        <div className="mt-2">
          <TabsContent className="mt-0" value="internal">
            <div className="grid gap-2">
              <Label className="text-muted-foreground text-xs">
                Select Page
              </Label>
              <Select
                disabled={loading}
                onValueChange={onChange}
                value={pages.some((p) => p.value === value) ? value : ""}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loading ? "Loading..." : "Select a page"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((page) => (
                    <SelectItem key={page.value} value={page.value}>
                      {page.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent className="mt-0" value="external">
            <div className="grid gap-2">
              <Label className="text-muted-foreground text-xs">URL</Label>
              <Input
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://example.com"
                value={value}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
