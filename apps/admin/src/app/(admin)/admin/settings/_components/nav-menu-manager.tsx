"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import {
  Tree,
  type NodeModel,
  type DragLayerMonitorProps,
  type RenderParams,
  type PlaceholderRender,
  getBackendOptions,
  mutateTreeWithIndex,
} from "@minoru/react-dnd-treeview"
import { useRouter } from "next/navigation"
import {
  createNavMenuItem,
  deleteNavMenuItem,
  syncNavMenuStructure,
  updateNavMenuItem,
  type NavMenuAdminItem,
  type NavMenuStructureItem,
} from "@/app/actions/nav-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/lib/hooks/use-toast"
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Edit2, PlusCircle, RefreshCcw, Trash2 } from "lucide-react"

const ROOT_ID = 0
const INDENT_WIDTH = 24

type NavTreeItem = NodeModel<NavMenuAdminItem>

interface NavMenuManagerProps {
  items: NavMenuAdminItem[]
}

interface NavItemFormValues {
  slug: string
  parentId: string | null
  path: string
  url: string
  isExternal: boolean
  translations: Record<Locale, string>
}

const localeFlag: Record<Locale, string> = {
  en: "🇬🇧",
  no: "🇳🇴",
}

const defaultTranslations = (): Record<Locale, string> =>
  SUPPORTED_LOCALES.reduce((acc, locale) => {
    acc[locale] = ""
    return acc
  }, {} as Record<Locale, string>)

const toTreeItems = (nodes: NavMenuAdminItem[], parent: string | number | null = ROOT_ID): NavTreeItem[] =>
  nodes.flatMap((node, index) => {
    const currentParent = parent === null ? ROOT_ID : parent
    return [
      {
        id: node.id,
        parent: currentParent,
        droppable: true,
        text: node.translations.no || node.translations.en || node.slug,
        data: { ...node, order: index },
      } satisfies NavTreeItem,
      ...toTreeItems(node.children, node.id),
    ]
  })

const buildNestedFromTree = (treeItems: NavTreeItem[]): NavMenuAdminItem[] => {
  const map = new Map<string | number, NavMenuAdminItem & { children: NavMenuAdminItem[] }>()

  treeItems.forEach((item) => {
    map.set(item.id, {
      ...item.data,
      parentId: item.parent === ROOT_ID ? null : String(item.parent),
      order: item.data.order ?? 0,
      children: [],
    })
  })

  const roots: NavMenuAdminItem[] = []

  treeItems.forEach((item) => {
    const entry = map.get(item.id)!
    if (entry.parentId) {
      const parent = map.get(entry.parentId)
      if (parent) {
        entry.order = parent.children.length + 1
        parent.children.push(entry)
      }
    } else {
      entry.order = roots.length + 1
      roots.push(entry)
    }
  })

  return roots
}

const buildStructurePayload = (
  nodes: NavMenuAdminItem[],
  parentId: string | null = null,
  acc: NavMenuStructureItem[] = []
) => {
  nodes.forEach((node, index) => {
    acc.push({ id: node.id, parentId, order: index + 1 })
    buildStructurePayload(node.children, node.id, acc)
  })
  return acc
}

interface FormDialogProps {
  open: boolean
  title: string
  submitLabel: string
  initialValues: NavItemFormValues
  onSubmit: (values: NavItemFormValues) => Promise<{ success: boolean; error?: string }>
  parentOptions: { value: string | null; label: string }[]
  disableSlug?: boolean
  disableParentSelection?: boolean
  onOpenChange: (open: boolean) => void
}

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
  const [values, setValues] = useState<NavItemFormValues>(initialValues)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await onSubmit(values)
      if (!result.success) {
        toast({
          title: "Unable to save navigation item",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Navigation updated",
        description: "Changes have been saved successfully.",
      })
      onOpenChange(false)
    })
  }

  const updateField = <K extends keyof NavItemFormValues>(key: K, value: NavItemFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="nav-slug">Slug</Label>
            <Input
              id="nav-slug"
              value={values.slug}
              disabled={disableSlug}
              onChange={(e) => updateField("slug", e.target.value)}
              placeholder="e.g. for-students"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nav-parent">Parent</Label>
            <Select
              disabled={disableParentSelection}
              value={values.parentId ?? "root"}
              onValueChange={(value) => updateField("parentId", value === "root" ? null : value)}
            >
              <SelectTrigger id="nav-parent">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">None (top level)</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.value ?? "root"} value={option.value ?? "root"}>
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
              value={values.path}
              onChange={(e) => updateField("path", e.target.value)}
              placeholder="/for-students"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nav-url">URL (external)</Label>
            <Input
              id="nav-url"
              value={values.url}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="nav-external"
              checked={values.isExternal}
              onCheckedChange={(checked) => updateField("isExternal", checked)}
            />
            <Label htmlFor="nav-external">Open as external link</Label>
          </div>
          <div className="space-y-2">
            <Label>Translations</Label>
            <div className="grid gap-3">
              {SUPPORTED_LOCALES.map((locale) => (
                <div key={locale} className="grid gap-1.5">
                  <Label htmlFor={`translation-${locale}`} className="text-xs uppercase text-muted-foreground">
                    {localeFlag[locale]} {locale.toUpperCase()}
                  </Label>
                  <Input
                    id={`translation-${locale}`}
                    value={values.translations[locale] ?? ""}
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
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={() => setValues(initialValues)} disabled={isPending}>
            Reset
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FormConfig {
  mode: "create" | "child" | "edit" | null
  parentId: string | null
  parentLabel: string
  item?: NavMenuAdminItem
}

const NavMenuManager = ({ items }: NavMenuManagerProps) => {
  const router = useRouter()
  const [treeData, setTreeData] = useState<NavTreeItem[]>(toTreeItems(items))
  const [formConfig, setFormConfig] = useState<FormConfig>({ mode: null, parentId: null, parentLabel: "" })
  const [isSyncing, startTransition] = useTransition()

  useEffect(() => {
    setTreeData(toTreeItems(items))
  }, [items])

  const parentOptions = useMemo(() => {
    const nested = buildNestedFromTree(treeData)
    const result: { value: string | null; label: string }[] = []
    const traverse = (nodes: NavMenuAdminItem[], depth = 0) => {
      nodes.forEach((node) => {
        result.push({ value: node.id, label: `${" ".repeat(depth * 2)}${node.translations.no || node.translations.en || node.slug}` })
        traverse(node.children, depth + 1)
      })
    }
    traverse(nested)
    return result
  }, [treeData])

  const totalItems = treeData.length
  const topLevelItems = items.length
  const externalLinks = treeData.filter((node) => node.data?.isExternal).length
  const translationCoverage = useMemo(() => {
    const localeCount = Number(SUPPORTED_LOCALES.length)
    if (localeCount === 0 || totalItems === 0) return 0
    const filled = treeData.reduce((total, node) => {
      return (
        total +
        SUPPORTED_LOCALES.reduce((acc, locale) => {
          const value = node.data?.translations?.[locale]
          return acc + (value && value.trim().length > 0 ? 1 : 0)
        }, 0)
      )
    }, 0)
    return Math.round((filled / (totalItems * localeCount)) * 100)
  }, [treeData, totalItems])

  const persistChanges = (newTree: NavTreeItem[]) => {
    const nested = buildNestedFromTree(newTree)
    const payload = buildStructurePayload(nested)
    startTransition(async () => {
      const result = await syncNavMenuStructure(payload)
      if (!result.success) {
        toast({
          title: "Unable to reorder navigation",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        })
        setTreeData(toTreeItems(items))
        return
      }
      router.refresh()
    })
  }

  const handleManualSync = () => {
    const nested = buildNestedFromTree(treeData)
    const payload = buildStructurePayload(nested)
    startTransition(async () => {
      const result = await syncNavMenuStructure(payload)
      if (!result.success) {
        toast({
          title: "Unable to sync navigation",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Navigation synced",
        description: "Structure has been refreshed.",
      })
      router.refresh()
    })
  }

  const normalizeTree = (tree: NavTreeItem[]) =>
    tree.map((node) => ({
      ...node,
      droppable: true,
    }))

  const handleDrop = (
    _tree: NodeModel<NavMenuAdminItem>[],
    { dragSourceId, dropTargetId, destinationIndex }: { dragSourceId?: NodeModel["id"]; dropTargetId: NodeModel["id"]; destinationIndex?: number }
  ) => {
    if (dragSourceId === undefined || dropTargetId === undefined) return
    const mutated = mutateTreeWithIndex(treeData, dragSourceId, dropTargetId, destinationIndex ?? 0) as NavTreeItem[]
    const normalizedTree = normalizeTree(mutated)
    setTreeData(normalizedTree)
    persistChanges(normalizedTree)
  }

  const openCreateDialog = (parentId: string | null, parentLabel: string) => {
    setFormConfig({ mode: parentId ? "child" : "create", parentId, parentLabel })
  }

  const closeDialog = () => setFormConfig({ mode: null, parentId: null, parentLabel: "" })

  const handleEdit = (item: NavMenuAdminItem) => {
    setFormConfig({ mode: "edit", parentId: item.parentId, parentLabel: "", item })
  }

  const handleAddChild = (item: NavMenuAdminItem) => {
    openCreateDialog(item.id, item.translations.no || item.translations.en || item.slug)
  }

  const handleDelete = (item: NavMenuAdminItem) => {
    if (item.children.length > 0) {
      toast({
        title: "Cannot delete",
        description: "Move or delete child items first.",
        variant: "destructive",
      })
      return
    }

    if (!window.confirm(`Delete navigation item “${item.slug}”?`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteNavMenuItem(item.id)
      if (!result.success) {
        toast({
          title: "Unable to delete",
          description: result.error ?? "Unexpected error occurred",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Navigation item deleted",
        description: `“${item.slug}” has been removed.`,
      })
      router.refresh()
    })
  }

  const handleSubmitFactory = () => {
    if (formConfig.mode === "edit" && formConfig.item) {
      return (values: NavItemFormValues) =>
        updateNavMenuItem({
          id: formConfig.item!.id,
          parentId: values.parentId,
          path: values.path,
          url: values.url,
          isExternal: values.isExternal,
          translations: values.translations,
        }).then((result) => {
          if (result.success) router.refresh()
          return result
        })
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
        if (result.success) router.refresh()
        return result
      })
  }

  const metrics = [
    { label: "Total entries", value: totalItems },
    { label: "Top level", value: topLevelItems },
    { label: "External links", value: externalLinks },
    { label: "Translation ready", value: `${translationCoverage}%` },
  ]

  const dialogTitle =
    formConfig.mode === "edit"
      ? "Edit navigation item"
      : formConfig.parentId
        ? `Create child under ${formConfig.parentLabel || "parent"}`
        : "Create navigation item"

  const dialogSubmitLabel =
    formConfig.mode === "edit" ? "Save changes" : formConfig.mode === "child" ? "Create child" : "Create item"

  const initialValues: NavItemFormValues = formConfig.mode === "edit" && formConfig.item
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
      }

  const renderNode = (
    node: NodeModel<NavMenuAdminItem>,
    { depth, isOpen, onToggle, hasChild, isDragging, isDropTarget }: RenderParams
  ) => {
    const item = node.data
    const indent = depth * INDENT_WIDTH
    const title = item.translations.no || item.translations.en || item.slug
    return (
      <motion.div
        layout
        className={cn(
          "group relative flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white/85 px-3 py-2 text-xs shadow-sm backdrop-blur-sm transition",
          isDropTarget && "ring-2 ring-primary/30",
          isDragging && "scale-[0.99] border-primary/30 shadow-md"
        )}
        style={{ marginLeft: indent }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {hasChild && (
              <button
                onClick={onToggle}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary-70 transition hover:border-primary/40 hover:bg-primary/10"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
            )}
            <span className="text-sm font-semibold text-primary-100">{title}</span>
            <Badge variant="outline" className="bg-primary/5 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary-70">
              {item.slug}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-primary-60">
            {item.path && <span className="rounded-full bg-primary/5 px-2 py-0.5 font-medium text-primary-70">{item.path}</span>}
            {item.url && (
              <span className="rounded-full bg-secondary-20/30 px-2 py-0.5 font-medium text-secondary-100">
                {item.url}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-primary/20 bg-white/70 px-3 text-xs font-semibold text-primary-80 hover:bg-primary/5"
            onClick={() => handleAddChild(item)}
          >
            <PlusCircle className="mr-1 h-3.5 w-3.5" />
            Child
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-primary/20 bg-white/70 px-3 text-xs font-semibold text-primary-80 hover:bg-primary/5"
            onClick={() => handleEdit(item)}
          >
            <Edit2 className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 rounded-xl bg-destructive/90 px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive"
            onClick={() => handleDelete(item)}
            disabled={item.children.length > 0}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </motion.div>
    )
  }

  const renderPlaceholder: PlaceholderRender<NavMenuAdminItem> = (node, { depth }) => (
    <div
      className={cn(
        "flex h-9 items-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-xs font-semibold uppercase tracking-wide text-primary-60",
        depth === 0 ? "ml-0" : ""
      )}
      style={{ marginLeft: depth * INDENT_WIDTH }}
    >
      Dropping {node?.text ? `before "${node.text}"` : "item"}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="surface-spotlight glass-panel accent-ring relative overflow-hidden rounded-3xl border border-primary/10 bg-white/85 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-80">
                Navigasjon
              </Badge>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary-70">
                Live sitemap
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold leading-tight text-primary-100 sm:text-3xl">Navigation tree</h2>
              <p className="max-w-2xl text-sm text-primary-60">
                Administrer hierarki, lenker og språk for hovedmenyen. Dra og slipp for å oppdatere strukturen i sanntid.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => openCreateDialog(null, "")}
                className="rounded-xl bg-primary-40 px-4 text-white shadow-[0_20px_35px_-28px_rgba(0,71,151,0.8)] hover:bg-primary-30"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add item
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-primary/20 bg-white/70 px-4 text-primary-80 hover:bg-primary/5"
                onClick={handleManualSync}
                disabled={isSyncing}
              >
                <RefreshCcw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                Sync structure
              </Button>
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-primary/10 bg-white/70 px-3 py-2">
                <span className="text-xs uppercase tracking-[0.18em] text-primary-50">{metric.label}</span>
                <span className="block text-lg font-semibold text-primary-100">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card variant="glass" className="border border-primary/10 bg-white/90 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 border-b border-primary/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-primary-100">Current navigation</CardTitle>
            <p className="text-sm text-primary-60">Hold inne elementer for å flytte dem. Indenter for å endre nivå.</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-primary/10 bg-white/70 px-3 py-1 text-xs font-medium text-primary-70">
            <span className="inline-flex h-2 w-2 rounded-full bg-secondary-100" />
            {isSyncing ? "Syncing changes…" : "Live"}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <DndProvider backend={HTML5Backend} options={getBackendOptions() as any}>
            <Tree
              tree={treeData}
              rootId={ROOT_ID}
              render={(node, params) => renderNode(node as NodeModel<NavMenuAdminItem>, params)}
              dragPreviewRender={(monitorProps) => (
                <motion.div className="rounded-xl border border-primary/20 bg-white/90 px-4 py-2 text-sm font-medium text-primary-90 shadow-lg">
                  Moving: {(monitorProps.item as NavTreeItem).data?.translations?.no ?? (monitorProps.item as NavTreeItem).text}
                </motion.div>
              )}
              onDrop={handleDrop}
              canDrop={() => true}
              insertDroppableFirst
              dropTargetOffset={8}
              sort={false}
              placeholderRender={renderPlaceholder}
              classes={{
                root: "space-y-2",
                dropTarget: "ring-2 ring-primary/40 rounded-2xl bg-primary/5",
                placeholder: "h-9 rounded-2xl border border-dashed border-primary/40 bg-primary/5",
              }}
            />
          </DndProvider>
        </CardContent>
      </Card>

      <AnimatePresence>
        {formConfig.mode && (
          <NavItemFormDialog
            open={formConfig.mode !== null}
            title={dialogTitle}
            submitLabel={dialogSubmitLabel}
            initialValues={initialValues}
            onSubmit={handleSubmitFactory()}
            parentOptions={parentOptions.filter((option) => option.value !== formConfig.item?.id)}
            disableSlug={formConfig.mode === "edit"}
            disableParentSelection={formConfig.mode === "child"}
            onOpenChange={(open) => {
              if (!open) closeDialog()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export { NavMenuManager }
