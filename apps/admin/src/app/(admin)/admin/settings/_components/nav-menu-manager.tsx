"use client";

import {
  getBackendOptions,
  mutateTreeWithIndex,
  type NodeModel,
  type PlaceholderRender,
  type RenderParams,
  Tree,
} from "@minoru/react-dnd-treeview";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Edit2,
  PlusCircle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  createNavMenuItem,
  deleteNavMenuItem,
  type NavMenuAdminItem,
  type NavMenuStructureItem,
  syncNavMenuStructure,
  updateNavMenuItem,
} from "@/app/actions/nav-menu";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { toast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROOT_ID = 0;
const INDENT_WIDTH = 24;

type NavTreeItem = NodeModel<NavMenuAdminItem>;

type NavMenuManagerProps = {
  items: NavMenuAdminItem[];
};

type NavItemFormValues = {
  slug: string;
  parentId: string | null;
  path: string;
  url: string;
  isExternal: boolean;
  translations: Record<Locale, string>;
};

const localeFlag: Record<Locale, string> = {
  en: "🇬🇧",
  no: "🇳🇴",
};

const defaultTranslations = (): Record<Locale, string> =>
  SUPPORTED_LOCALES.reduce(
    (acc, locale) => {
      acc[locale] = "";
      return acc;
    },
    {} as Record<Locale, string>
  );

const toTreeItems = (
  nodes: NavMenuAdminItem[],
  parent: string | number | null = ROOT_ID
): NavTreeItem[] =>
  nodes.flatMap((node, index) => {
    const currentParent = parent === null ? ROOT_ID : parent;
    return [
      {
        id: node.id,
        parent: currentParent,
        droppable: true,
        text: node.translations.no || node.translations.en || node.slug,
        data: { ...node, order: index },
      } satisfies NavTreeItem,
      ...toTreeItems(node.children, node.id),
    ];
  });

const buildNestedFromTree = (treeItems: NavTreeItem[]): NavMenuAdminItem[] => {
  const map = new Map<
    string | number,
    NavMenuAdminItem & { children: NavMenuAdminItem[] }
  >();

  treeItems.forEach((item) => {
    map.set(item.id, {
      ...item.data,
      parentId: item.parent === ROOT_ID ? null : String(item.parent),
      order: item.data.order ?? 0,
      children: [],
    });
  });

  const roots: NavMenuAdminItem[] = [];

  treeItems.forEach((item) => {
    const entry = map.get(item.id)!;
    if (entry.parentId) {
      const parent = map.get(entry.parentId);
      if (parent) {
        entry.order = parent.children.length + 1;
        parent.children.push(entry);
      }
    } else {
      entry.order = roots.length + 1;
      roots.push(entry);
    }
  });

  return roots;
};

const buildStructurePayload = (
  nodes: NavMenuAdminItem[],
  parentId: string | null = null,
  acc: NavMenuStructureItem[] = []
) => {
  nodes.forEach((node, index) => {
    acc.push({ id: node.id, parentId, order: index + 1 });
    buildStructurePayload(node.children, node.id, acc);
  });
  return acc;
};

type FormDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValues: NavItemFormValues;
  onSubmit: (
    values: NavItemFormValues
  ) => Promise<{ success: boolean; error?: string }>;
  parentOptions: { value: string | null; label: string }[];
  disableSlug?: boolean;
  disableParentSelection?: boolean;
  onOpenChange: (open: boolean) => void;
};

const NavItemFormDialog = ({
  open,
  title,
  submitLabel,
  initialValues,
  onSubmit,
  parentOptions,
  disableSlug,
  disableParentSelection,
  onOpenChange,
}: FormDialogProps) => {
  const [values, setValues] = useState<NavItemFormValues>(initialValues);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.success) {
        toast({
          title: "Unable to save navigation item",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Navigation updated",
        description: "Changes have been saved successfully.",
      });
      onOpenChange(false);
    });
  };

  const updateField = <K extends keyof NavItemFormValues>(
    key: K,
    value: NavItemFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="nav-slug">Slug</Label>
            <Input
              disabled={disableSlug}
              id="nav-slug"
              onChange={(e) => updateField("slug", e.target.value)}
              placeholder="e.g. for-students"
              value={values.slug}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nav-parent">Parent</Label>
            <Select
              disabled={disableParentSelection}
              onValueChange={(value) =>
                updateField("parentId", value === "root" ? null : value)
              }
              value={values.parentId ?? "root"}
            >
              <SelectTrigger id="nav-parent">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">None (top level)</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem
                    key={option.value ?? "root"}
                    value={option.value ?? "root"}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nav-path">Path (internal)</Label>
            <Input
              id="nav-path"
              onChange={(e) => updateField("path", e.target.value)}
              placeholder="/for-students"
              value={values.path}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nav-url">URL (external)</Label>
            <Input
              id="nav-url"
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://example.com"
              value={values.url}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={values.isExternal}
              id="nav-external"
              onCheckedChange={(checked) => updateField("isExternal", checked)}
            />
            <Label htmlFor="nav-external">Open as external link</Label>
          </div>
          <div className="space-y-2">
            <Label>Translations</Label>
            <div className="grid gap-3">
              {SUPPORTED_LOCALES.map((locale) => (
                <div className="grid gap-1.5" key={locale}>
                  <Label
                    className="text-muted-foreground text-xs uppercase"
                    htmlFor={`translation-${locale}`}
                  >
                    {localeFlag[locale]} {locale.toUpperCase()}
                  </Label>
                  <Input
                    id={`translation-${locale}`}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        translations: {
                          ...prev.translations,
                          [locale]: e.target.value,
                        },
                      }))
                    }
                    placeholder={`Title (${locale.toUpperCase()})`}
                    value={values.translations[locale] ?? ""}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={() => setValues(initialValues)}
            variant="ghost"
          >
            Reset
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type FormConfig = {
  mode: "create" | "child" | "edit" | null;
  parentId: string | null;
  parentLabel: string;
  item?: NavMenuAdminItem;
};

const NavMenuManager = ({ items }: NavMenuManagerProps) => {
  const router = useRouter();
  const [treeData, setTreeData] = useState<NavTreeItem[]>(toTreeItems(items));
  const [formConfig, setFormConfig] = useState<FormConfig>({
    mode: null,
    parentId: null,
    parentLabel: "",
  });
  const [isSyncing, startTransition] = useTransition();

  useEffect(() => {
    setTreeData(toTreeItems(items));
  }, [items]);

  const parentOptions = useMemo(() => {
    const nested = buildNestedFromTree(treeData);
    const result: { value: string | null; label: string }[] = [];
    const traverse = (nodes: NavMenuAdminItem[], depth = 0) => {
      nodes.forEach((node) => {
        result.push({
          value: node.id,
          label: `${" ".repeat(depth * 2)}${node.translations.no || node.translations.en || node.slug}`,
        });
        traverse(node.children, depth + 1);
      });
    };
    traverse(nested);
    return result;
  }, [treeData]);

  const totalItems = treeData.length;
  const topLevelItems = items.length;
  const externalLinks = treeData.filter((node) => node.data?.isExternal).length;
  const translationCoverage = useMemo(() => {
    const localeCount = Number(SUPPORTED_LOCALES.length);
    if (localeCount === 0 || totalItems === 0) {
      return 0;
    }
    const filled = treeData.reduce(
      (total, node) =>
        total +
        SUPPORTED_LOCALES.reduce((acc, locale) => {
          const value = node.data?.translations?.[locale];
          return acc + (value && value.trim().length > 0 ? 1 : 0);
        }, 0),
      0
    );
    return Math.round((filled / (totalItems * localeCount)) * 100);
  }, [treeData, totalItems]);

  const persistChanges = (newTree: NavTreeItem[]) => {
    const nested = buildNestedFromTree(newTree);
    const payload = buildStructurePayload(nested);
    startTransition(async () => {
      const result = await syncNavMenuStructure(payload);
      if (!result.success) {
        toast({
          title: "Unable to reorder navigation",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        });
        setTreeData(toTreeItems(items));
        return;
      }
      router.refresh();
    });
  };

  const handleManualSync = () => {
    const nested = buildNestedFromTree(treeData);
    const payload = buildStructurePayload(nested);
    startTransition(async () => {
      const result = await syncNavMenuStructure(payload);
      if (!result.success) {
        toast({
          title: "Unable to sync navigation",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Navigation synced",
        description: "Structure has been refreshed.",
      });
      router.refresh();
    });
  };

  const normalizeTree = (tree: NavTreeItem[]) =>
    tree.map((node) => ({
      ...node,
      droppable: true,
    }));

  const handleDrop = (
    _tree: NodeModel<NavMenuAdminItem>[],
    {
      dragSourceId,
      dropTargetId,
      destinationIndex,
    }: {
      dragSourceId?: NodeModel["id"];
      dropTargetId: NodeModel["id"];
      destinationIndex?: number;
    }
  ) => {
    if (dragSourceId === undefined || dropTargetId === undefined) {
      return;
    }
    const mutated = mutateTreeWithIndex(
      treeData,
      dragSourceId,
      dropTargetId,
      destinationIndex ?? 0
    ) as NavTreeItem[];
    const normalizedTree = normalizeTree(mutated);
    setTreeData(normalizedTree);
    persistChanges(normalizedTree);
  };

  const openCreateDialog = (parentId: string | null, parentLabel: string) => {
    setFormConfig({
      mode: parentId ? "child" : "create",
      parentId,
      parentLabel,
    });
  };

  const closeDialog = () =>
    setFormConfig({ mode: null, parentId: null, parentLabel: "" });

  const handleEdit = (item: NavMenuAdminItem) => {
    setFormConfig({
      mode: "edit",
      parentId: item.parentId,
      parentLabel: "",
      item,
    });
  };

  const handleAddChild = (item: NavMenuAdminItem) => {
    openCreateDialog(
      item.id,
      item.translations.no || item.translations.en || item.slug
    );
  };

  const handleDelete = (item: NavMenuAdminItem) => {
    if (item.children.length > 0) {
      toast({
        title: "Cannot delete",
        description: "Move or delete child items first.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Delete navigation item “${item.slug}”?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteNavMenuItem(item.id);
      if (!result.success) {
        toast({
          title: "Unable to delete",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Navigation item deleted",
        description: `“${item.slug}” has been removed.`,
      });
      router.refresh();
    });
  };

  const handleSubmitFactory = () => {
    if (formConfig.mode === "edit" && formConfig.item) {
      return (values: NavItemFormValues) =>
        updateNavMenuItem({
          id: formConfig.item?.id,
          parentId: values.parentId,
          path: values.path,
          url: values.url,
          isExternal: values.isExternal,
          translations: values.translations,
        }).then((result) => {
          if (result.success) {
            router.refresh();
          }
          return result;
        });
    }

    return (values: NavItemFormValues) =>
      createNavMenuItem({
        slug: values.slug,
        parentId: values.parentId,
        path: values.path,
        url: values.url,
        isExternal: values.isExternal,
        translations: values.translations,
      }).then((result) => {
        if (result.success) {
          router.refresh();
        }
        return result;
      });
  };

  const metrics = [
    { label: "Total entries", value: totalItems },
    { label: "Top level", value: topLevelItems },
    { label: "External links", value: externalLinks },
    { label: "Translation ready", value: `${translationCoverage}%` },
  ];

  const dialogTitle =
    formConfig.mode === "edit"
      ? "Edit navigation item"
      : formConfig.parentId
        ? `Create child under ${formConfig.parentLabel || "parent"}`
        : "Create navigation item";

  const dialogSubmitLabel =
    formConfig.mode === "edit"
      ? "Save changes"
      : formConfig.mode === "child"
        ? "Create child"
        : "Create item";

  const initialValues: NavItemFormValues =
    formConfig.mode === "edit" && formConfig.item
      ? {
          slug: formConfig.item.slug,
          parentId: formConfig.item.parentId,
          path: formConfig.item.path ?? "",
          url: formConfig.item.url ?? "",
          isExternal: formConfig.item.isExternal,
          translations: { ...formConfig.item.translations },
        }
      : {
          slug: "",
          parentId: formConfig.parentId,
          path: "",
          url: "",
          isExternal: false,
          translations: defaultTranslations(),
        };

  const renderNode = (
    node: NodeModel<NavMenuAdminItem>,
    {
      depth,
      isOpen,
      onToggle,
      hasChild,
      isDragging,
      isDropTarget,
    }: RenderParams
  ) => {
    const item = node.data;
    const indent = depth * INDENT_WIDTH;
    const title = item.translations.no || item.translations.en || item.slug;
    return (
      <motion.div
        className={cn(
          "group relative flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white/85 px-3 py-2 text-xs shadow-sm backdrop-blur-sm transition",
          isDropTarget && "ring-2 ring-primary/30",
          isDragging && "scale-[0.99] border-primary/30 shadow-md"
        )}
        layout
        style={{ marginLeft: indent }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {hasChild && (
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary-70 transition hover:border-primary/40 hover:bg-primary/10"
                onClick={onToggle}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            )}
            <span className="font-semibold text-primary-100 text-sm">
              {title}
            </span>
            <Badge
              className="bg-primary/5 px-2 py-0 font-semibold text-[10px] text-primary-70 uppercase tracking-wide"
              variant="outline"
            >
              {item.slug}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-primary-60">
            {item.path && (
              <span className="rounded-full bg-primary/5 px-2 py-0.5 font-medium text-primary-70">
                {item.path}
              </span>
            )}
            {item.url && (
              <span className="rounded-full bg-secondary-20/30 px-2 py-0.5 font-medium text-secondary-100">
                {item.url}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            className="h-8 rounded-xl border-primary/20 bg-white/70 px-3 font-semibold text-primary-80 text-xs hover:bg-primary/5"
            onClick={() => handleAddChild(item)}
            size="sm"
            variant="outline"
          >
            <PlusCircle className="mr-1 h-3.5 w-3.5" />
            Child
          </Button>
          <Button
            className="h-8 rounded-xl border-primary/20 bg-white/70 px-3 font-semibold text-primary-80 text-xs hover:bg-primary/5"
            onClick={() => handleEdit(item)}
            size="sm"
            variant="outline"
          >
            <Edit2 className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            className="h-8 rounded-xl bg-destructive/90 px-3 font-semibold text-destructive-foreground text-xs hover:bg-destructive"
            disabled={item.children.length > 0}
            onClick={() => handleDelete(item)}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </motion.div>
    );
  };

  const renderPlaceholder: PlaceholderRender<NavMenuAdminItem> = (
    node,
    { depth }
  ) => (
    <div
      className={cn(
        "flex h-9 items-center rounded-2xl border-2 border-primary/40 border-dashed bg-primary/5 px-4 font-semibold text-primary-60 text-xs uppercase tracking-wide",
        depth === 0 ? "ml-0" : ""
      )}
      style={{ marginLeft: depth * INDENT_WIDTH }}
    >
      Dropping {node?.text ? `before "${node.text}"` : "item"}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="surface-spotlight glass-panel relative overflow-hidden rounded-3xl border border-primary/10 bg-white/85 px-6 py-6 accent-ring sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-[0.65rem] text-primary-80 uppercase tracking-[0.2em]"
                variant="outline"
              >
                Navigasjon
              </Badge>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 font-semibold text-primary-70 text-xs">
                Live sitemap
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="font-semibold text-2xl text-primary-100 leading-tight sm:text-3xl">
                Navigation tree
              </h2>
              <p className="max-w-2xl text-primary-60 text-sm">
                Administrer hierarki, lenker og språk for hovedmenyen. Dra og
                slipp for å oppdatere strukturen i sanntid.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-xl bg-primary-40 px-4 text-white shadow-[0_20px_35px_-28px_rgba(0,71,151,0.8)] hover:bg-primary-30"
                onClick={() => openCreateDialog(null, "")}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add item
              </Button>
              <Button
                className="rounded-xl border-primary/20 bg-white/70 px-4 text-primary-80 hover:bg-primary/5"
                disabled={isSyncing}
                onClick={handleManualSync}
                size="sm"
                variant="outline"
              >
                <RefreshCcw
                  className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")}
                />
                Sync structure
              </Button>
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            {metrics.map((metric) => (
              <div
                className="rounded-2xl border border-primary/10 bg-white/70 px-3 py-2"
                key={metric.label}
              >
                <span className="text-primary-50 text-xs uppercase tracking-[0.18em]">
                  {metric.label}
                </span>
                <span className="block font-semibold text-lg text-primary-100">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card
        className="border border-primary/10 bg-white/90 backdrop-blur"
        variant="glass"
      >
        <CardHeader className="flex flex-col gap-3 border-primary/10 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-semibold text-base text-primary-100">
              Current navigation
            </CardTitle>
            <p className="text-primary-60 text-sm">
              Hold inne elementer for å flytte dem. Indenter for å endre nivå.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-primary/10 bg-white/70 px-3 py-1 font-medium text-primary-70 text-xs">
            <span className="inline-flex h-2 w-2 rounded-full bg-secondary-100" />
            {isSyncing ? "Syncing changes…" : "Live"}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <DndProvider
            backend={HTML5Backend}
            options={getBackendOptions() as any}
          >
            <Tree
              canDrop={() => true}
              classes={{
                root: "space-y-2",
                dropTarget: "ring-2 ring-primary/40 rounded-2xl bg-primary/5",
                placeholder:
                  "h-9 rounded-2xl border border-dashed border-primary/40 bg-primary/5",
              }}
              dragPreviewRender={(monitorProps) => (
                <motion.div className="rounded-xl border border-primary/20 bg-white/90 px-4 py-2 font-medium text-primary-90 text-sm shadow-lg">
                  Moving:{" "}
                  {(monitorProps.item as NavTreeItem).data?.translations?.no ??
                    (monitorProps.item as NavTreeItem).text}
                </motion.div>
              )}
              dropTargetOffset={8}
              insertDroppableFirst
              onDrop={handleDrop}
              placeholderRender={renderPlaceholder}
              render={(node, params) =>
                renderNode(node as NodeModel<NavMenuAdminItem>, params)
              }
              rootId={ROOT_ID}
              sort={false}
              tree={treeData}
            />
          </DndProvider>
        </CardContent>
      </Card>

      <AnimatePresence>
        {formConfig.mode && (
          <NavItemFormDialog
            disableParentSelection={formConfig.mode === "child"}
            disableSlug={formConfig.mode === "edit"}
            initialValues={initialValues}
            onOpenChange={(open) => {
              if (!open) {
                closeDialog();
              }
            }}
            onSubmit={handleSubmitFactory()}
            open={formConfig.mode !== null}
            parentOptions={parentOptions.filter(
              (option) => option.value !== formConfig.item?.id
            )}
            submitLabel={dialogSubmitLabel}
            title={dialogTitle}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export { NavMenuManager };
