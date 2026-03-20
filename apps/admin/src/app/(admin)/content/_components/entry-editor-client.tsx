"use client";

import type {
  ContentEntryRecord,
  ContentTemplateRecord,
  EditorialQueryItem,
  TemplateFieldSchema,
} from "@repo/api/editorial";
import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import {
  translateManagedContentLocale,
  upsertManagedContentEntry,
} from "@/app/actions/editorial";
import { RichTextEditor } from "@/components/rich-text-editor";

type LocaleState = {
  title: string;
  description: string;
  fieldValues: Record<string, unknown>;
  translationStatus: "source" | "manual" | "ai" | "stale";
  translatedFromLocale: Locale | null;
  sourceUpdatedAt: string | null;
};

function sanitizePath(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/\\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function isRelationField(field: TemplateFieldSchema) {
  return field.type === "relation" && field.collection;
}

type RelationOptionsByField = Record<
  string,
  { no: EditorialQueryItem[]; en: EditorialQueryItem[] }
>;

type FieldChangeHandler = (value: unknown) => void;

function renderTextareaField(
  fieldValue: unknown,
  onFieldChange: FieldChangeHandler
) {
  return (
    <Textarea
      onChange={(event) => onFieldChange(event.target.value)}
      rows={4}
      value={typeof fieldValue === "string" ? fieldValue : ""}
    />
  );
}

function renderRichTextField(
  fieldValue: unknown,
  onFieldChange: FieldChangeHandler
) {
  return (
    <RichTextEditor
      content={typeof fieldValue === "string" ? fieldValue : ""}
      onChange={(content) => onFieldChange(content)}
    />
  );
}

function renderBooleanField(
  fieldValue: unknown,
  onFieldChange: FieldChangeHandler
) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-3">
      <Checkbox
        checked={Boolean(fieldValue)}
        onCheckedChange={(checked) => onFieldChange(Boolean(checked))}
      />
      <span className="text-sm">Enabled</span>
    </div>
  );
}

function renderSelectField(
  field: TemplateFieldSchema,
  fieldValue: unknown,
  onFieldChange: FieldChangeHandler
) {
  return (
    <Select
      onValueChange={(value) => onFieldChange(value)}
      value={typeof fieldValue === "string" ? fieldValue : ""}
    >
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder ?? "Select a value"} />
      </SelectTrigger>
      <SelectContent>
        {(field.options ?? []).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function renderMultiRelationField(
  field: TemplateFieldSchema,
  selectedIds: string[],
  options: EditorialQueryItem[],
  onFieldChange: FieldChangeHandler
) {
  return (
    <div className="space-y-2 rounded-2xl border p-3">
      {options.map((option) => {
        const checkboxId = `${field.id}-${option.id}`;

        return (
          <div className="flex items-center gap-3" key={option.id}>
            <Checkbox
              checked={selectedIds.includes(option.id)}
              id={checkboxId}
              onCheckedChange={(checked) => {
                const nextIds = checked
                  ? [...selectedIds, option.id]
                  : selectedIds.filter((id) => id !== option.id);
                onFieldChange(nextIds);
              }}
            />
            <Label htmlFor={checkboxId}>{option.title}</Label>
          </div>
        );
      })}
    </div>
  );
}

function renderSingleRelationField(
  fieldValue: unknown,
  options: EditorialQueryItem[],
  onFieldChange: FieldChangeHandler
) {
  return (
    <Select
      onValueChange={(value) => onFieldChange(value)}
      value={typeof fieldValue === "string" ? fieldValue : ""}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select related content" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function renderPrimitiveField(
  field: TemplateFieldSchema,
  fieldValue: unknown,
  onFieldChange: FieldChangeHandler
) {
  let inputType = "text";
  if (field.type === "number") {
    inputType = "number";
  } else if (field.type === "date") {
    inputType = "date";
  }

  let inputValue = "";
  if (field.type === "number") {
    inputValue = String(fieldValue ?? "");
  } else if (typeof fieldValue === "string") {
    inputValue = fieldValue;
  }

  return (
    <Input
      onChange={(event) =>
        onFieldChange(
          field.type === "number"
            ? Number(event.target.value || 0)
            : event.target.value
        )
      }
      type={inputType}
      value={inputValue}
    />
  );
}

function renderFieldControl({
  field,
  fieldValue,
  activeLocale,
  relationOptions,
  onFieldChange,
}: {
  field: TemplateFieldSchema;
  fieldValue: unknown;
  activeLocale: Locale;
  relationOptions: RelationOptionsByField;
  onFieldChange: FieldChangeHandler;
}) {
  switch (field.type) {
    case "textarea":
      return renderTextareaField(fieldValue, onFieldChange);
    case "rich-text":
      return renderRichTextField(fieldValue, onFieldChange);
    case "boolean":
      return renderBooleanField(fieldValue, onFieldChange);
    case "select":
      return renderSelectField(field, fieldValue, onFieldChange);
    default: {
      if (!isRelationField(field)) {
        return renderPrimitiveField(field, fieldValue, onFieldChange);
      }

      const options = relationOptions[field.id]?.[activeLocale] ?? [];
      if (field.allowMultiple) {
        const selectedIds = Array.isArray(fieldValue)
          ? fieldValue.map(String)
          : [];

        return renderMultiRelationField(
          field,
          selectedIds,
          options,
          onFieldChange
        );
      }

      return renderSingleRelationField(fieldValue, options, onFieldChange);
    }
  }
}

export function EntryEditorClient({
  entry,
  template,
  relationOptions,
}: {
  entry: ContentEntryRecord;
  template: ContentTemplateRecord;
  relationOptions: RelationOptionsByField;
}) {
  const templateVersion = template.publishedVersion;
  if (!templateVersion) {
    throw new Error("Template must have a published version.");
  }

  const [status, setStatus] = useState<PageStatus>(entry.status);
  const [visibility, setVisibility] = useState<PageVisibility>(
    entry.visibility
  );
  const [sourceLocale, setSourceLocale] = useState<Locale>(entry.sourceLocale);
  const [activeLocale, setActiveLocale] = useState<Locale>(entry.sourceLocale);
  const [path, setPath] = useState(entry.path ?? "");
  const [isPathManual, setIsPathManual] = useState(Boolean(entry.path));
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [locales, setLocales] = useState<Record<Locale, LocaleState>>({
    [Locale.NO]: mapLocaleState(entry, Locale.NO),
    [Locale.EN]: mapLocaleState(entry, Locale.EN),
  });

  const localesRef = useRef(locales);
  const statusRef = useRef(status);
  const visibilityRef = useRef(visibility);
  const sourceLocaleRef = useRef(sourceLocale);
  const pathRef = useRef(path);
  const mountedRef = useRef(false);
  const sourceTitle = locales[sourceLocale]?.title ?? "";

  useEffect(() => {
    localesRef.current = locales;
    statusRef.current = status;
    visibilityRef.current = visibility;
    sourceLocaleRef.current = sourceLocale;
    pathRef.current = path;
  }, [locales, path, sourceLocale, status, visibility]);

  useEffect(() => {
    if (!isPathManual) {
      setPath(sanitizePath(sourceTitle));
    }
  }, [isPathManual, sourceTitle]);

  const autosaveKey = useMemo(
    () =>
      JSON.stringify({
        locales,
        path,
        sourceLocale,
        status,
        visibility,
      }),
    [locales, path, sourceLocale, status, visibility]
  );

  const persist = async (nextStatus?: PageStatus) => {
    setSaveState("saving");

    try {
      const savedEntry = await upsertManagedContentEntry({
        entryId: entry.id,
        kind: entry.kind,
        path: pathRef.current,
        status: nextStatus ?? statusRef.current,
        visibility: visibilityRef.current,
        sourceLocale: sourceLocaleRef.current,
        templateId: entry.templateId,
        locales: [Locale.NO, Locale.EN].map((locale) => {
          const state = localesRef.current[locale];
          return {
            locale,
            title: state.title,
            description: state.description,
            fieldValues: state.fieldValues,
            translationStatus: state.translationStatus,
            translatedFromLocale: state.translatedFromLocale,
            sourceUpdatedAt: state.sourceUpdatedAt,
          };
        }),
      });

      setStatus(savedEntry.status);
      setSaveState("saved");
      setPreviewNonce(Date.now());
    } catch {
      setSaveState("error");
    }
  };

  const debouncedSave = useDebouncedCallback(() => {
    persist();
  }, 800);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (!autosaveKey) {
      return;
    }

    debouncedSave();
  }, [autosaveKey, debouncedSave]);

  const localeBadges = useMemo(
    () =>
      [Locale.NO, Locale.EN].reduce<Record<Locale, string>>(
        (accumulator, locale) => {
          const localeState = locales[locale];
          if (locale === sourceLocale) {
            accumulator[locale] = "source";
            return accumulator;
          }

          accumulator[locale] = localeState.translationStatus;
          return accumulator;
        },
        {
          [Locale.NO]: "manual",
          [Locale.EN]: "manual",
        }
      ),
    [locales, sourceLocale]
  );

  const updateLocaleState = (
    locale: Locale,
    updater: (state: LocaleState) => LocaleState
  ) => {
    setLocales((current) => {
      const updated = {
        ...current,
        [locale]: updater(current[locale]),
      };

      if (locale === sourceLocale) {
        for (const otherLocale of [Locale.NO, Locale.EN]) {
          if (otherLocale !== locale) {
            updated[otherLocale] = {
              ...updated[otherLocale],
              translationStatus: "stale",
            };
          }
        }
      }

      return updated;
    });
  };

  const handleTranslate = (targetLocale: Locale) => {
    startTransition(async () => {
      try {
        const translated = await translateManagedContentLocale({
          entryId: entry.id,
          targetLocale,
        });

        setLocales((current) => ({
          ...current,
          [targetLocale]: {
            title: translated.title,
            description: translated.description,
            fieldValues: translated.fieldValues,
            translationStatus: translated.translationStatus,
            translatedFromLocale: translated.translatedFromLocale,
            sourceUpdatedAt: translated.sourceUpdatedAt,
          },
        }));
        toast.success(`Translated ${targetLocale.toUpperCase()} draft`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Translation failed"
        );
      }
    });
  };

  const renderField = (field: TemplateFieldSchema) => {
    const localeState = locales[activeLocale];
    const fieldValue = localeState.fieldValues[field.id];
    const onFieldChange = (value: unknown) => {
      updateLocaleState(activeLocale, (state) => ({
        ...state,
        fieldValues: {
          ...state.fieldValues,
          [field.id]: value,
        },
        translationStatus: activeLocale === sourceLocale ? "source" : "manual",
      }));
    };

    return renderFieldControl({
      field,
      fieldValue,
      activeLocale,
      relationOptions,
      onFieldChange,
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="rounded-3xl border bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-xl">{template.name}</h2>
              <p className="text-muted-foreground text-sm">
                Editing a structured {entry.kind} entry.
              </p>
            </div>
            <Badge variant="outline">{entry.kind}</Badge>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="entry-path">Path</Label>
              <Input
                id="entry-path"
                onChange={(event) => {
                  setIsPathManual(true);
                  setPath(sanitizePath(event.target.value));
                }}
                placeholder="departments/marketing"
                value={path}
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                onValueChange={(value) => setStatus(value as PageStatus)}
                value={status}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PageStatus.DRAFT}>Draft</SelectItem>
                  <SelectItem value={PageStatus.PUBLISHED}>
                    Published
                  </SelectItem>
                  <SelectItem value={PageStatus.ARCHIVED}>Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Visibility</Label>
              <Select
                onValueChange={(value) =>
                  setVisibility(value as PageVisibility)
                }
                value={visibility}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PageVisibility.PUBLIC}>Public</SelectItem>
                  <SelectItem value={PageVisibility.AUTHENTICATED}>
                    Authenticated
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Source locale</Label>
              <Select
                onValueChange={(value) => {
                  const nextSourceLocale = value as Locale;
                  setSourceLocale(nextSourceLocale);
                  setLocales((current) => ({
                    ...current,
                    [Locale.NO]: {
                      ...current[Locale.NO],
                      translationStatus:
                        nextSourceLocale === Locale.NO ? "source" : "stale",
                    },
                    [Locale.EN]: {
                      ...current[Locale.EN],
                      translationStatus:
                        nextSourceLocale === Locale.EN ? "source" : "stale",
                    },
                  }));
                }}
                value={sourceLocale}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Locale.NO}>Norwegian</SelectItem>
                  <SelectItem value={Locale.EN}>English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => persist(PageStatus.DRAFT)}
                variant="outline"
              >
                Save Draft
              </Button>
              <Button onClick={() => persist(PageStatus.PUBLISHED)}>
                Publish
              </Button>
            </div>

            <div className="text-muted-foreground text-xs">
              {saveState === "saving" && "Saving changes..."}
              {saveState === "saved" && "Preview updated."}
              {saveState === "error" && "Failed to save latest changes."}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Locales</h3>
              <p className="text-muted-foreground text-sm">
                Choose manual editing or AI translation for each locale.
              </p>
            </div>
            <Badge variant="secondary">Live preview</Badge>
          </div>

          <Tabs
            onValueChange={(value) => setActiveLocale(value as Locale)}
            value={activeLocale}
          >
            <TabsList className="w-full">
              {[Locale.NO, Locale.EN].map((locale) => (
                <TabsTrigger className="flex-1" key={locale} value={locale}>
                  {locale.toUpperCase()} · {localeBadges[locale]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor={`title-${activeLocale}`}>Title</Label>
              <Input
                id={`title-${activeLocale}`}
                onChange={(event) =>
                  updateLocaleState(activeLocale, (state) => ({
                    ...state,
                    title: event.target.value,
                    translationStatus:
                      activeLocale === sourceLocale ? "source" : "manual",
                  }))
                }
                value={locales[activeLocale].title}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`description-${activeLocale}`}>Description</Label>
              <Textarea
                id={`description-${activeLocale}`}
                onChange={(event) =>
                  updateLocaleState(activeLocale, (state) => ({
                    ...state,
                    description: event.target.value,
                    translationStatus:
                      activeLocale === sourceLocale ? "source" : "manual",
                  }))
                }
                rows={4}
                value={locales[activeLocale].description}
              />
            </div>

            {activeLocale !== sourceLocale && (
              <Button
                onClick={() => handleTranslate(activeLocale)}
                size="sm"
                variant="outline"
              >
                AI translate from {sourceLocale.toUpperCase()}
              </Button>
            )}

            {templateVersion.fieldSchema.map((field) => (
              <div className="grid gap-2" key={field.id}>
                <Label>{field.label}</Label>
                {renderField(field)}
                {field.description && (
                  <p className="text-muted-foreground text-xs">
                    {field.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-background">
        <iframe
          className="min-h-[1200px] w-full bg-white"
          src={`/content/entries/${entry.id}/preview?locale=${activeLocale}&t=${previewNonce}`}
          title="Editorial preview"
        />
      </div>
    </div>
  );
}

function mapLocaleState(
  entry: ContentEntryRecord,
  locale: Locale
): LocaleState {
  const localeRecord =
    entry.locales.find((entryLocale) => entryLocale.locale === locale) ??
    entry.locales.find(
      (entryLocale) => entryLocale.locale === entry.sourceLocale
    ) ??
    entry.locales[0];

  return {
    title: localeRecord?.title ?? "",
    description: localeRecord?.description ?? "",
    fieldValues: localeRecord?.fieldValues ?? {},
    translationStatus:
      locale === entry.sourceLocale
        ? "source"
        : (localeRecord?.translationStatus ?? "manual"),
    translatedFromLocale:
      localeRecord?.translatedFromLocale ?? entry.sourceLocale,
    sourceUpdatedAt: localeRecord?.sourceUpdatedAt ?? null,
  };
}
