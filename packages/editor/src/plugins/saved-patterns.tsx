"use client";

import type { ComponentData, Plugin } from "@puckeditor/core";
import { createUsePuck, useGetPuck } from "@puckeditor/core";

const usePuck = createUsePuck();

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Download,
  FolderOpen,
  Plus,
  Puzzle,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cloneWithNewIds, createId } from "../utils/clone-block";

const STORAGE_KEY = "biso-editor-patterns";

type SavedPattern = {
  id: string;
  name: string;
  blocks: ComponentData[];
  createdAt: string;
};

function loadPatterns(): SavedPattern[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePatterns(patterns: SavedPattern[]): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
}

function describeBlocks(blocks: ComponentData[]): string {
  if (blocks.length === 0) {
    return "Empty pattern";
  }
  const types = blocks.map((b) => b.type);
  if (types.length <= 3) {
    return types.join(" + ");
  }
  return `${types.slice(0, 3).join(" + ")} +${types.length - 3} more`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Category = "my" | "shared";

function PatternCard({
  pattern,
  onInsert,
  onDelete,
}: {
  pattern: SavedPattern;
  onInsert: (pattern: SavedPattern) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground text-sm">
            {pattern.name}
          </div>
          <div className="truncate text-muted-foreground text-xs">
            {describeBlocks(pattern.blocks)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {formatDate(pattern.createdAt)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          className="h-7 text-xs"
          onClick={() => onInsert(pattern)}
          size="sm"
        >
          <Download className="mr-1" size={12} />
          Insert
        </Button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <Button
              className="h-7 text-xs"
              onClick={() => {
                onDelete(pattern.id);
                setConfirmDelete(false);
              }}
              size="sm"
              variant="destructive"
            >
              Confirm
            </Button>
            <Button
              className="h-7 text-xs"
              onClick={() => setConfirmDelete(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            className="h-7 text-destructive text-xs hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1" size={12} />
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

function SavePatternForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning("Please enter a name for the pattern.");
      return;
    }
    onSave(trimmed);
  };

  return (
    <form
      className="space-y-2 rounded-md border border-border p-3"
      onSubmit={handleSubmit}
    >
      <Label className="text-xs">Pattern name</Label>
      <Input
        autoFocus
        className="h-8 text-sm"
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Hero with CTA"
        value={name}
      />
      <div className="flex gap-2">
        <Button className="h-7 text-xs" size="sm" type="submit">
          <Plus className="mr-1" size={12} />
          Save
        </Button>
        <Button
          className="h-7 text-xs"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SavedPatternsPanel() {
  const selectedItem = usePuck((s) => s.selectedItem);
  const getPuck = useGetPuck();
  const [patterns, setPatterns] = useState<SavedPattern[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [category, setCategory] = useState<Category>("my");

  // Load patterns from localStorage on mount
  useEffect(() => {
    setPatterns(loadPatterns());
  }, []);

  const selectedBlockType = selectedItem?.type ?? null;

  const handleSavePattern = useCallback(
    (name: string) => {
      const { appState, selectedItem: currentSelectedItem } = getPuck();
      if (!currentSelectedItem) {
        toast.warning("No block selected.");
        return;
      }

      const block = appState.data.content?.find(
        (item) => item.props?.id === (currentSelectedItem.props as any)?.id
      );

      if (!block) {
        toast.error("Could not find the selected block in page content.");
        return;
      }

      const newPattern: SavedPattern = {
        id: createId("pattern"),
        name,
        blocks: [block],
        createdAt: new Date().toISOString(),
      };

      const updated = [newPattern, ...patterns];
      setPatterns(updated);
      savePatterns(updated);
      setShowSaveForm(false);
      toast.success(`Pattern "${name}" saved.`);
    },
    [getPuck, patterns]
  );

  const handleInsertPattern = useCallback(
    (pattern: SavedPattern) => {
      const { config, dispatch, selectedItem: currentSelectedItem } = getPuck();
      const clonedBlocks = pattern.blocks.map((block) =>
        cloneWithNewIds(block, config)
      );

      const selectedId =
        (currentSelectedItem?.props as { id?: string } | undefined)?.id ?? null;

      dispatch({
        type: "setData",
        recordHistory: true,
        data: (previous) => {
          const current = previous.content ?? [];
          const index =
            selectedId === null
              ? -1
              : current.findIndex((item) => item.props?.id === selectedId);
          const insertIndex = index >= 0 ? index + 1 : current.length;

          return {
            ...previous,
            root: previous.root,
            content: [
              ...current.slice(0, insertIndex),
              ...clonedBlocks,
              ...current.slice(insertIndex),
            ],
          };
        },
      });

      toast.success(`Inserted pattern "${pattern.name}".`);
    },
    [getPuck]
  );

  const handleDeletePattern = useCallback(
    (id: string) => {
      const updated = patterns.filter((p) => p.id !== id);
      setPatterns(updated);
      savePatterns(updated);
      toast.success("Pattern deleted.");
    },
    [patterns]
  );

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <Puzzle className="text-primary" size={18} />
          Saved Patterns
        </div>
        <p className="text-muted-foreground text-sm">
          Save and reuse block arrangements.
        </p>
      </div>

      {/* Save current selection */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">
          Save Current Selection
        </h3>
        {selectedBlockType ? (
          <>
            <p className="text-muted-foreground text-xs">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {selectedBlockType}
              </span>
            </p>
            {showSaveForm ? (
              <SavePatternForm
                onCancel={() => setShowSaveForm(false)}
                onSave={handleSavePattern}
              />
            ) : (
              <Button
                onClick={() => setShowSaveForm(true)}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-2" size={14} />
                Save as pattern
              </Button>
            )}
          </>
        ) : (
          <Card className="p-3">
            <p className="text-center text-muted-foreground text-xs">
              Select a block on the canvas to save it as a pattern.
            </p>
          </Card>
        )}
      </section>

      {/* Category tabs */}
      <section className="space-y-3">
        <div className="flex gap-1 rounded-md border border-border p-1">
          <button
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 font-medium text-xs transition-colors ${
              category === "my"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setCategory("my")}
            type="button"
          >
            <FolderOpen size={13} />
            My Patterns
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 font-medium text-xs transition-colors ${
              category === "shared"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setCategory("shared")}
            type="button"
          >
            <Users size={13} />
            Shared Patterns
          </button>
        </div>

        {category === "my" ? (
          patterns.length > 0 ? (
            <div className="grid gap-3">
              {patterns.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  onDelete={handleDeletePattern}
                  onInsert={handleInsertPattern}
                  pattern={pattern}
                />
              ))}
            </div>
          ) : (
            <Card className="p-4">
              <p className="text-center text-muted-foreground text-xs">
                No saved patterns yet. Select a block and save it as a pattern
                to get started.
              </p>
            </Card>
          )
        ) : (
          <Card className="p-4">
            <p className="text-center text-muted-foreground text-xs">
              Shared team patterns are coming soon. Patterns saved here will be
              available to all team members.
            </p>
          </Card>
        )}
      </section>

      {/* Footer info */}
      <div className="text-muted-foreground text-xs">
        {patterns.length} saved pattern{patterns.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export const savedPatternsPlugin: Plugin = {
  name: "saved-patterns",
  label: "Patterns",
  icon: <Puzzle size={18} />,
  render: () => <SavedPatternsPanel />,
};
