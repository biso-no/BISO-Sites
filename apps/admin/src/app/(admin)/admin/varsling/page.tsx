"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { getCampuses } from "@/app/actions/campus";
import { 
  getAllVarslingSettings, 
  createVarslingSettings, 
  updateVarslingSettings, 
  deleteVarslingSettings,
  type VarslingSettings 
} from "@/app/actions/varsling";
import { Campus } from "@/lib/types/campus";

interface VarslingFormData {
  campus_id: string;
  role_name: string;
  email: string;
  is_active: boolean;
  sort_order: number;
}

export default function VarslingAdminPage() {
  const t = useTranslations('varsling.admin');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [settings, setSettings] = useState<VarslingSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VarslingFormData>({
    campus_id: "",
    role_name: "",
    email: "",
    is_active: true,
    sort_order: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [campusData, settingsData] = await Promise.all([
          getCampuses(),
          getAllVarslingSettings()
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
      sort_order: 0
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
      sort_order: setting.sort_order
    });
    setEditingId(setting.$id!);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.campus_id || !formData.role_name || !formData.email) {
      setSubmitStatus({
        type: 'error',
        message: t('messages.validation')
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      let result;
      if (editingId) {
        result = await updateVarslingSettings(editingId, formData);
      } else {
        result = await createVarslingSettings(formData);
      }

      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: editingId ? t('messages.updated') : t('messages.created')
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
          type: 'error',
          message: result.error || t('messages.error')
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: t('messages.error')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('messages.deleteConfirm'))) {
      return;
    }

    try {
      const result = await deleteVarslingSettings(id);
      if (result.success) {
        const updatedSettings = await getAllVarslingSettings();
        setSettings(updatedSettings);
      } else {
        alert(t('messages.deleteError'));
      }
    } catch (error) {
      alert(t('messages.deleteUnexpected'));
    }
  };

  const toggleActive = async (setting: VarslingSettings) => {
    try {
      const result = await updateVarslingSettings(setting.$id!, {
        is_active: !setting.is_active
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
    const campus = campuses.find(c => c.$id === campusId);
    return campus?.name || campusId;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-60" />
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-primary-60">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addContact')}
        </Button>
      </div>

      {/* Settings Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('table.title')}</CardTitle>
          <CardDescription>
            {t('table.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="text-center py-8 text-primary-60">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('table.empty.title')}</p>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                {t('table.empty.button')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.headers.campus')}</TableHead>
                  <TableHead>{t('table.headers.role')}</TableHead>
                  <TableHead>{t('table.headers.email')}</TableHead>
                  <TableHead>{t('table.headers.sorting')}</TableHead>
                  <TableHead>{t('table.headers.status')}</TableHead>
                  <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
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
                        <Badge variant={setting.is_active ? "default" : "secondary"}>
                          {setting.is_active ? t('table.status.active') : t('table.status.inactive')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(setting)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(setting.$id!)}
                          className="text-red-600 hover:text-red-700"
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('dialog.edit.title') : t('dialog.create.title')}
            </DialogTitle>
            <DialogDescription>
              {editingId 
                ? t('dialog.edit.description')
                : t('dialog.create.description')
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campus Selection */}
            <div className="space-y-2">
              <Label>{t('dialog.fields.campus.label')} *</Label>
              <Select 
                value={formData.campus_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, campus_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialog.fields.campus.placeholder')} />
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
              <Label>{t('dialog.fields.role.label')} *</Label>
              <Input
                value={formData.role_name}
                onChange={(e) => setFormData(prev => ({ ...prev, role_name: e.target.value }))}
                placeholder={t('dialog.fields.role.placeholder')}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>{t('dialog.fields.email.label')} *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t('dialog.fields.email.placeholder')}
              />
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label>{t('dialog.fields.sortOrder.label')}</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                placeholder={t('dialog.fields.sortOrder.placeholder')}
              />
              <p className="text-xs text-primary-60">
                {t('dialog.fields.sortOrder.description')}
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>{t('dialog.fields.active.label')}</Label>
            </div>

            {/* Submit Status */}
            {submitStatus && (
              <Alert className={submitStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {submitStatus.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={submitStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                    {submitStatus.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                {t('dialog.buttons.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('dialog.buttons.saving') : (editingId ? t('dialog.buttons.update') : t('dialog.buttons.create'))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
