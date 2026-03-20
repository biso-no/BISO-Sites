"use client";

import "@repo/editor/styles.css";

import type {
  ContentTemplateRecord,
  EditorialFamily,
  TemplateBinding,
  TemplateFieldSchema,
} from "@repo/api/editorial";
import type { Config } from "@repo/editor";
import { config } from "@repo/editor/config";
import { type Data, Puck } from "@repo/editor/puck";
import { getPuckFieldOverrides, puckViewports } from "@repo/editor/puck-ui";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  publishManagedContentTemplate,
  rollbackManagedContentTemplate,
  saveManagedContentTemplateDraft,
} from "@/app/actions/editorial";

const EMPTY_DOCUMENT: Data = {
  root: { props: {} },
  content: [],
};

type TemplateStudioDraftState = {
  templateId: string | null;
  key: string;
  name: string;
  family: EditorialFamily;
  description: string;
  layoutData: Data;
  fieldSchemaJson: string;
  bindingsJson: string;
  previewSeedJson: string;
  notes: string;
};

function getStarterFieldSchema(family: EditorialFamily): TemplateFieldSchema[] {
  if (family === "policy") {
    return [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "description", label: "Lead", type: "textarea" },
      { id: "body", label: "Body", type: "rich-text", required: true },
    ];
  }

  if (family === "article") {
    return [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "description", label: "Summary", type: "textarea" },
      { id: "heroImage", label: "Hero image", type: "image" },
      { id: "body", label: "Body", type: "rich-text", required: true },
    ];
  }

  return [
    { id: "title", label: "Title", type: "text", required: true },
    { id: "description", label: "Description", type: "textarea" },
    { id: "heroImage", label: "Hero image", type: "image" },
    { id: "ctaLabel", label: "Primary CTA label", type: "text" },
    { id: "ctaHref", label: "Primary CTA URL", type: "url" },
  ];
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Invalid ${label} JSON`);
  }
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function persistTemplateDraft(
  state: TemplateStudioDraftState
): Promise<ContentTemplateRecord> {
  return saveManagedContentTemplateDraft({
    templateId: state.templateId ?? undefined,
    key: state.key,
    name: state.name,
    family: state.family,
    description: state.description,
    layoutDocument: state.layoutData,
    fieldSchema: parseJson<TemplateFieldSchema[]>(
      state.fieldSchemaJson,
      "field schema"
    ),
    bindings: parseJson<TemplateBinding[]>(state.bindingsJson, "bindings"),
    previewSeedData: parseJson<Record<string, unknown>>(
      state.previewSeedJson,
      "preview seed"
    ),
    notes: state.notes,
  });
}

function useTemplateStudioActions({
  state,
  setTemplateId,
}: {
  state: TemplateStudioDraftState;
  setTemplateId: (templateId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const syncDraft = async (): Promise<ContentTemplateRecord> => {
    const nextTemplate = await persistTemplateDraft(state);
    setTemplateId(nextTemplate.id);

    if (!state.templateId) {
      router.replace(`/content/templates/${nextTemplate.id}`);
    }

    return nextTemplate;
  };

  const runAction = (action: () => Promise<void>, fallbackMessage: string) => {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        toast.error(getActionErrorMessage(error, fallbackMessage));
      }
    });
  };

  return {
    isPending,
    handleSave: () =>
      runAction(async () => {
        await syncDraft();
        toast.success("Template draft saved");
      }, "Failed to save template"),
    handlePublish: () =>
      runAction(async () => {
        const nextTemplate = await syncDraft();
        await publishManagedContentTemplate(nextTemplate.id);
        toast.success("Template published");
        router.refresh();
      }, "Failed to publish template"),
    handleRollback: (publishedVersionId: string) =>
      runAction(async () => {
        if (!state.templateId) {
          return;
        }

        await rollbackManagedContentTemplate(
          state.templateId,
          publishedVersionId
        );
        toast.success("Template rolled back");
        router.refresh();
      }, "Failed to roll back template"),
  };
}

function PublishedVersionActions({
  isPending,
  publishedVersions,
  onRollback,
}: {
  isPending: boolean;
  publishedVersions: ContentTemplateRecord["versions"];
  onRollback: (publishedVersionId: string) => void;
}) {
  if (!publishedVersions || publishedVersions.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>Published versions</Label>
      <div className="flex flex-wrap gap-2">
        {publishedVersions.map((version) => (
          <Button
            disabled={isPending}
            key={version.id}
            onClick={() => onRollback(version.id)}
            size="sm"
            variant="outline"
          >
            Roll back to v{version.version}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function TemplateStudioClient({
  initialTemplate,
}: {
  initialTemplate?: ContentTemplateRecord | null;
}) {
  const initialVersion =
    initialTemplate?.draftVersion ?? initialTemplate?.publishedVersion;
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? null);
  const [key, setKey] = useState(initialTemplate?.key ?? "");
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [family, setFamily] = useState<EditorialFamily>(
    initialTemplate?.family ?? "page"
  );
  const [description, setDescription] = useState(
    initialTemplate?.description ?? ""
  );
  const [layoutData, setLayoutData] = useState<Data>(
    initialVersion?.layoutDocument ?? EMPTY_DOCUMENT
  );
  const [fieldSchemaJson, setFieldSchemaJson] = useState(
    stringifyPretty(
      initialVersion?.fieldSchema ??
        getStarterFieldSchema(initialTemplate?.family ?? "page")
    )
  );
  const [bindingsJson, setBindingsJson] = useState(
    stringifyPretty(
      initialVersion?.bindings ?? ([] satisfies TemplateBinding[])
    )
  );
  const [previewSeedJson, setPreviewSeedJson] = useState(
    stringifyPretty(initialVersion?.previewSeedData ?? {})
  );
  const [notes, setNotes] = useState(initialVersion?.notes ?? "");
  const { handlePublish, handleRollback, handleSave, isPending } =
    useTemplateStudioActions({
      state: {
        templateId,
        key,
        name,
        family,
        description,
        layoutData,
        fieldSchemaJson,
        bindingsJson,
        previewSeedJson,
        notes,
      },
      setTemplateId,
    });

  const publishedVersions = useMemo(
    () =>
      (initialTemplate?.versions ?? []).filter(
        (version) => version.status === "published"
      ),
    [initialTemplate?.versions]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <CardShell title="Template model">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Department landing"
                value={name}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-key">Key</Label>
              <Input
                id="template-key"
                onChange={(event) => setKey(event.target.value)}
                placeholder="department-landing"
                value={key}
              />
            </div>

            <div className="grid gap-2">
              <Label>Family</Label>
              <Select
                onValueChange={(value) => setFamily(value as EditorialFamily)}
                value={family}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Page</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                value={description}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-fields">Field schema JSON</Label>
              <Textarea
                className="font-mono text-xs"
                id="template-fields"
                onChange={(event) => setFieldSchemaJson(event.target.value)}
                rows={16}
                value={fieldSchemaJson}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-bindings">Bindings JSON</Label>
              <Textarea
                className="font-mono text-xs"
                id="template-bindings"
                onChange={(event) => setBindingsJson(event.target.value)}
                rows={16}
                value={bindingsJson}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-preview-seed">Preview seed JSON</Label>
              <Textarea
                className="font-mono text-xs"
                id="template-preview-seed"
                onChange={(event) => setPreviewSeedJson(event.target.value)}
                rows={10}
                value={previewSeedJson}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-notes">Compatibility notes</Label>
              <Textarea
                id="template-notes"
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                value={notes}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isPending}
                onClick={handleSave}
                variant="outline"
              >
                Save Draft
              </Button>
              <Button disabled={isPending} onClick={handlePublish}>
                Publish
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">
                Draft v{initialTemplate?.draftVersion?.version ?? "New"}
              </Badge>
              <Badge variant="secondary">
                Live v{initialTemplate?.publishedVersion?.version ?? "None"}
              </Badge>
            </div>

            <PublishedVersionActions
              isPending={isPending}
              onRollback={handleRollback}
              publishedVersions={publishedVersions}
            />
          </div>
        </CardShell>

        <div className="overflow-hidden rounded-3xl border bg-background">
          <Puck
            config={config as Config}
            data={layoutData}
            headerTitle={name || "Untitled template"}
            metadata={{ locale: "no" } as never}
            onChange={(nextData) => setLayoutData(nextData as Data)}
            onPublish={(nextData) => setLayoutData(nextData as Data)}
            overrides={getPuckFieldOverrides()}
            renderHeaderActions={() => (
              <div className="pr-4 text-sm text-white/80">
                Layout authoring only. Bind live data through the model panel.
              </div>
            )}
            viewports={puckViewports}
          />
        </div>
      </div>
    </div>
  );
}

function CardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-background p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}
