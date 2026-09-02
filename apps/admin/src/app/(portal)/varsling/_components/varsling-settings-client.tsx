"use client";

import type { VarslingSettings } from "@repo/api/types/appwrite";
import { Eye, EyeOff, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createVarslingSetting,
  deleteVarslingSetting,
  setVarslingSettingActive,
  updateVarslingSetting,
  type VarslingSettingFormValues,
} from "../../_actions/varsling";
import { EmptyState } from "../../_components/empty-state";
import { PortalButton } from "../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../_components/portal-fields";
import {
  STUDIO,
  StudioButton,
  StudioPageHeader,
  StudioPanel,
  StudioStatusPill,
} from "../../_components/studio";

interface CampusOption {
  id: string;
  name: string;
}

interface VarslingSettingsClientProps {
  campuses: CampusOption[];
  settings: VarslingSettings[];
}

const EMPTY_FORM: VarslingSettingFormValues = {
  campus_id: "",
  email: "",
  is_active: true,
  role_name: "",
  sort_order: 0,
};

function toFormValues(setting: VarslingSettings): VarslingSettingFormValues {
  return {
    campus_id: setting.campus_id,
    email: setting.email,
    is_active: setting.is_active,
    role_name: setting.role_name,
    sort_order: setting.sort_order ?? 0,
  };
}

export function VarslingSettingsClient({
  campuses,
  settings,
}: VarslingSettingsClientProps) {
  const t = useTranslations("varsling.admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<VarslingSettingFormValues>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const campusName = (id: string) =>
    campuses.find((campus) => campus.id === id)?.name ?? id;

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, campus_id: campuses[0]?.id ?? "" });
    setIsCreating(true);
  }

  function openEdit(setting: VarslingSettings) {
    setIsCreating(false);
    setEditingId(setting.$id);
    setForm(toFormValues(setting));
  }

  function closeForm() {
    setIsCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!(form.campus_id && form.role_name.trim() && form.email.trim())) {
      toast.error(t("messages.validation"));
      return;
    }
    startTransition(async () => {
      const result = editingId
        ? await updateVarslingSetting(editingId, form)
        : await createVarslingSetting(form);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editingId ? t("messages.updated") : t("messages.created"));
      closeForm();
      router.refresh();
    });
  }

  function handleToggleActive(setting: VarslingSettings) {
    startTransition(async () => {
      const nextActive = !setting.is_active;
      const result = await setVarslingSettingActive(setting.$id, nextActive);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        nextActive ? t("messages.activated") : t("messages.deactivated")
      );
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      toast.message(t("messages.deleteConfirm"));
      return;
    }
    startTransition(async () => {
      const result = await deleteVarslingSetting(id);
      if ("error" in result) {
        toast.error(result.error || t("messages.deleteError"));
        return;
      }
      toast.success(t("messages.deleted"));
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  const isFormOpen = isCreating || editingId !== null;

  return (
    <>
      <StudioPageHeader
        description={t("subtitle")}
        eyebrow={
          <>
            <ShieldAlert size={13} />
            {t("table.title")}
          </>
        }
        title={t("title")}
      >
        <StudioButton onClick={openCreate} variant="primary">
          <Plus size={15} />
          {t("addContact")}
        </StudioButton>
      </StudioPageHeader>

      {isFormOpen && (
        <StudioPanel className="mb-6 p-6">
          <h2 className="font-semibold text-base" style={{ color: STUDIO.ink }}>
            {editingId ? t("dialog.edit.title") : t("dialog.create.title")}
          </h2>
          <p className="mt-1 text-sm" style={{ color: STUDIO.ink3 }}>
            {editingId
              ? t("dialog.edit.description")
              : t("dialog.create.description")}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <PortalField label={t("dialog.fields.campus.label")} required>
              <PortalSelect
                onChange={(e) =>
                  setForm({ ...form, campus_id: e.target.value })
                }
                options={campuses.map((campus) => ({
                  label: campus.name,
                  value: campus.id,
                }))}
                placeholder={t("dialog.fields.campus.placeholder")}
                value={form.campus_id}
              />
            </PortalField>

            <PortalField
              hint={t("dialog.fields.role.description")}
              label={t("dialog.fields.role.label")}
              required
            >
              <PortalInput
                maxLength={100}
                onChange={(e) =>
                  setForm({ ...form, role_name: e.target.value })
                }
                placeholder={t("dialog.fields.role.placeholder")}
                value={form.role_name}
              />
            </PortalField>

            <PortalField label={t("dialog.fields.email.label")} required>
              <PortalInput
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t("dialog.fields.email.placeholder")}
                type="email"
                value={form.email}
              />
            </PortalField>

            <PortalField
              hint={t("dialog.fields.sortOrder.description")}
              label={t("dialog.fields.sortOrder.label")}
            >
              <PortalInput
                onChange={(e) =>
                  setForm({
                    ...form,
                    sort_order: Number(e.target.value) || 0,
                  })
                }
                placeholder={t("dialog.fields.sortOrder.placeholder")}
                type="number"
                value={String(form.sort_order)}
              />
            </PortalField>
          </div>

          <label
            className="mt-4 flex w-fit items-center gap-2 text-sm"
            style={{ color: STUDIO.ink2 }}
          >
            <input
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
              type="checkbox"
            />
            {t("dialog.fields.active.label")}
          </label>

          <div className="mt-6 flex items-center gap-3">
            <PortalButton
              loading={isPending}
              onClick={handleSubmit}
              variant="primary"
            >
              {(() => {
                if (isPending) {
                  return t("dialog.buttons.saving");
                }
                return editingId
                  ? t("dialog.buttons.update")
                  : t("dialog.buttons.create");
              })()}
            </PortalButton>
            <PortalButton onClick={closeForm} variant="ghost">
              {t("dialog.buttons.cancel")}
            </PortalButton>
          </div>
        </StudioPanel>
      )}

      {settings.length === 0 ? (
        <EmptyState
          description={t("table.description")}
          icon={<ShieldAlert size={28} />}
          title={t("table.empty.title")}
        >
          <StudioButton onClick={openCreate} variant="primary">
            <Plus size={15} />
            {t("table.empty.button")}
          </StudioButton>
        </EmptyState>
      ) : (
        <StudioPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: STUDIO.rule, color: STUDIO.ink3 }}
                >
                  <th className="px-5 py-3 font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.campus")}
                  </th>
                  <th className="px-5 py-3 font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.role")}
                  </th>
                  <th className="px-5 py-3 font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.email")}
                  </th>
                  <th className="px-5 py-3 font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.sorting")}
                  </th>
                  <th className="px-5 py-3 font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.status")}
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-[11px] uppercase tracking-[0.06em]">
                    {t("table.headers.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr
                    className="border-b last:border-b-0"
                    key={setting.$id}
                    style={{ borderColor: STUDIO.rule }}
                  >
                    <td className="px-5 py-3" style={{ color: STUDIO.ink2 }}>
                      {campusName(setting.campus_id)}
                    </td>
                    <td
                      className="px-5 py-3 font-medium"
                      style={{ color: STUDIO.ink }}
                    >
                      {setting.role_name}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        className="underline-offset-2 hover:underline"
                        href={`mailto:${setting.email}`}
                        style={{ color: STUDIO.sky }}
                      >
                        {setting.email}
                      </a>
                    </td>
                    <td className="px-5 py-3" style={{ color: STUDIO.ink3 }}>
                      {setting.sort_order ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <StudioStatusPill
                        label={
                          setting.is_active
                            ? t("table.status.active")
                            : t("table.status.inactive")
                        }
                        status={setting.is_active ? "published" : "draft"}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <PortalButton
                          onClick={() => handleToggleActive(setting)}
                          size="sm"
                          title={
                            setting.is_active
                              ? t("actions.deactivate")
                              : t("actions.activate")
                          }
                          variant="ghost"
                        >
                          {setting.is_active ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                          {setting.is_active
                            ? t("actions.deactivate")
                            : t("actions.activate")}
                        </PortalButton>
                        <PortalButton
                          onClick={() => openEdit(setting)}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil size={14} />
                          {t("actions.edit")}
                        </PortalButton>
                        <PortalButton
                          onClick={() => handleDelete(setting.$id)}
                          size="sm"
                          variant="danger"
                        >
                          <Trash2 size={14} />
                          {confirmDeleteId === setting.$id
                            ? t("actions.confirmDelete")
                            : t("actions.delete")}
                        </PortalButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StudioPanel>
      )}
    </>
  );
}
