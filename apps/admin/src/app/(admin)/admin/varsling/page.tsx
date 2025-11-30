"use client";

import type { Campus, VarslingSettings } from "@repo/api/types/appwrite";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getCampuses } from "@/app/actions/campus";
import {
  createVarslingSettings,
  deleteVarslingSettings,
  getAllVarslingSettings,
  updateVarslingSettings,
} from "@/app/actions/varsling";

type VarslingFormData = {
  campus_id: string;
  role_name: string;
  email: string;
  is_active: boolean;
  sort_order: number;
};

export default function VarslingAdminPage() {
  const t = useTranslations("varsling.admin");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [settings, setSettings] = useState<VarslingSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<VarslingFormData>({
    campus_id: "",
    role_name: "",
    email: "",
    is_active: true,
    sort_order: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [campusData, settingsData] = await Promise.all([
          getCampuses(),
          getAllVarslingSettings(),
        ]);
        setCampuses(campusData);
        setSettings(settingsData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      campus_id: "",
      role_name: "",
      email: "",
      is_active: true,
      sort_order: 0,
    });
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (setting: VarslingSettings) => {
    setFormData({
      campus_id: setting.campus_id,
      role_name: setting.role_name,
      email: setting.email,
      is_active: setting.is_active,
      sort_order: setting.sort_order,
    });
    setEditingId(setting.$id!);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(formData.campus_id && formData.role_name && formData.email)) {
      setSubmitStatus({
        type: "error",
        message: t("messages.validation"),
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const result = editingId
        ? await updateVarslingSettings(editingId, formData)
        : await createVarslingSettings(formData);

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: editingId ? t("messages.updated") : t("messages.created"),
        });

        // Reload settings
        const updatedSettings = await getAllVarslingSettings();
        setSettings(updatedSettings);

        // Close dialog after a short delay
        setTimeout(() => {
          setIsDialogOpen(false);
          setSubmitStatus(null);
        }, 1500);
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || t("messages.error"),
        });
      }
    } catch (_error) {
      setSubmitStatus({
        type: "error",
        message: t("messages.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteTargetId(null);
    setDeleteError(null);
    setIsDeleting(false);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteVarslingSettings(deleteTargetId);
      if (result.success) {
        const updatedSettings = await getAllVarslingSettings();
        setSettings(updatedSettings);
        closeDeleteDialog();
      } else {
        setDeleteError(result.error || t("messages.deleteError"));
      }
    } catch (_error) {
      setDeleteError(t("messages.deleteUnexpected"));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async (setting: VarslingSettings) => {
    try {
      const result = await updateVarslingSettings(setting.$id!, {
        is_active: !setting.is_active,
      });

      if (result.success) {
        const updatedSettings = await getAllVarslingSettings();
        setSettings(updatedSettings);
      }
    } catch (error) {
      console.error("Failed to toggle active status:", error);
    }
  };

  const getCampusName = (campusId: string) => {
    const campus = campuses.find((c) => c.$id === campusId);
    return campus?.name || campusId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        {t("messages.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-60" />
            <h1 className="font-bold text-2xl">{t("title")}</h1>
          </div>
          <p className="text-primary-60">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addContact")}
        </Button>
      </div>

      {/* Settings Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
          <CardDescription>{t("table.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="py-8 text-center text-primary-60">
              <Shield className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{t("table.empty.title")}</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t("table.empty.button")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.headers.campus")}</TableHead>
                  <TableHead>{t("table.headers.role")}</TableHead>
                  <TableHead>{t("table.headers.email")}</TableHead>
                  <TableHead>{t("table.headers.sorting")}</TableHead>
                  <TableHead>{t("table.headers.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("table.headers.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map((setting) => (
                  <TableRow key={setting.$id}>
                    <TableCell className="font-medium">
                      {getCampusName(setting.campus_id)}
                    </TableCell>
                    <TableCell>{setting.role_name}</TableCell>
                    <TableCell>{setting.email}</TableCell>
                    <TableCell>{setting.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={setting.is_active}
                          onCheckedChange={() => toggleActive(setting)}
                        />
                        <Badge
                          variant={setting.is_active ? "default" : "secondary"}
                        >
                          {setting.is_active
                            ? t("table.status.active")
                            : t("table.status.inactive")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => openEditDialog(setting)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openDeleteDialog(setting.$id!)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("dialog.edit.title") : t("dialog.create.title")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("dialog.edit.description")
                : t("dialog.create.description")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Campus Selection */}
            <div className="space-y-2">
              <Label>{t("dialog.fields.campus.label")} *</Label>
              <Select
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, campus_id: value }))
                }
                value={formData.campus_id}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("dialog.fields.campus.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.$id} value={campus.$id}>
                      {campus.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Name */}
            <div className="space-y-2">
              <Label>{t("dialog.fields.role.label")} *</Label>
              <Input
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role_name: e.target.value,
                  }))
                }
                placeholder={t("dialog.fields.role.placeholder")}
                value={formData.role_name}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>{t("dialog.fields.email.label")} *</Label>
              <Input
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder={t("dialog.fields.email.placeholder")}
                type="email"
                value={formData.email}
              />
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label>{t("dialog.fields.sortOrder.label")}</Label>
              <Input
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sort_order: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                placeholder={t("dialog.fields.sortOrder.placeholder")}
                type="number"
                value={formData.sort_order}
              />
              <p className="text-primary-60 text-xs">
                {t("dialog.fields.sortOrder.description")}
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label>{t("dialog.fields.active.label")}</Label>
            </div>

            {/* Submit Status */}
            {submitStatus && (
              <Alert
                className={
                  submitStatus.type === "success"
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <div className="flex items-center gap-2">
                  {submitStatus.type === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription
                    className={
                      submitStatus.type === "success"
                        ? "text-green-800"
                        : "text-red-800"
                    }
                  >
                    {submitStatus.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <DialogFooter>
              <Button
                disabled={isSubmitting}
                onClick={() => setIsDialogOpen(false)}
                type="button"
                variant="outline"
              >
                {t("dialog.buttons.cancel")}
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {(() => {
                  if (isSubmitting) {
                    return t("dialog.buttons.saving");
                  }
                  if (editingId) {
                    return t("dialog.buttons.update");
                  }
                  return t("dialog.buttons.create");
                })()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            closeDeleteDialog();
          }
        }}
        open={isDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("messages.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <Alert className="border-red-200 bg-red-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {deleteError}
                </AlertDescription>
              </div>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("dialog.buttons.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                await handleDelete();
              }}
            >
              {isDeleting ? t("messages.deleting") : t("table.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
