"use client";

import type { BenefitPartner } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Building2, Edit, Globe, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPartner,
  deletePartner,
  updatePartner,
} from "@/app/actions/benefit-partners";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";

type PartnersClientProps = {
  partners: BenefitPartner[];
  total: number;
};

type PartnerFormState = {
  name: string;
  website_url: string;
  logo_url: string;
  description_nb: string;
  description_en: string;
  campus_id: string;
};

const emptyForm: PartnerFormState = {
  name: "",
  website_url: "",
  logo_url: "",
  description_nb: "",
  description_en: "",
  campus_id: "5",
};

export function PartnersClient({ partners: initial }: PartnersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerFormState>(emptyForm);

  const handleSubmit = () => {
    if (!form.name) {
      return;
    }
    startTransition(async () => {
      if (editingId) {
        await updatePartner(editingId, {
          name: form.name,
          website_url: form.website_url || null,
          logo_url: form.logo_url || null,
          description_nb: form.description_nb || null,
          description_en: form.description_en || null,
          campus_id: form.campus_id || null,
        });
      } else {
        await createPartner({
          name: form.name,
          website_url: form.website_url || null,
          logo_url: form.logo_url || null,
          description_nb: form.description_nb || null,
          description_en: form.description_en || null,
          campus_id: form.campus_id || null,
          is_active: true,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    });
  };

  const handleEdit = (partner: BenefitPartner) => {
    setEditingId(partner.$id);
    setForm({
      name: partner.name,
      website_url: partner.website_url ?? "",
      logo_url: partner.logo_url ?? "",
      description_nb: partner.description_nb ?? "",
      description_en: partner.description_en ?? "",
      campus_id: partner.campus_id ?? "5",
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deletePartner(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Add partner form */}
      {showForm ? (
        <Card className="glass-panel border-primary/20">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? "Edit Partner" : "New Partner"}
            </CardTitle>
            <Button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="partner-name">Partner Name *</Label>
                <Input
                  id="partner-name"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Kaffebrenneriet"
                  value={form.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-website">Website URL</Label>
                <Input
                  id="partner-website"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, website_url: e.target.value }))
                  }
                  placeholder="https://..."
                  value={form.website_url}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-logo">Logo URL</Label>
                <Input
                  id="partner-logo"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, logo_url: e.target.value }))
                  }
                  placeholder="https://..."
                  value={form.logo_url}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-campus">Campus (scope)</Label>
                <select
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                  id="partner-campus"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, campus_id: e.target.value }))
                  }
                  value={form.campus_id}
                >
                  <option value="5">National (all campuses)</option>
                  <option value="1">Oslo</option>
                  <option value="2">Bergen</option>
                  <option value="3">Trondheim</option>
                  <option value="4">Stavanger</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-desc-nb">Description (Norwegian)</Label>
                <Input
                  id="partner-desc-nb"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description_nb: e.target.value }))
                  }
                  value={form.description_nb}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-desc-en">Description (English)</Label>
                <Input
                  id="partner-desc-en"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description_en: e.target.value }))
                  }
                  value={form.description_en}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={isPending || !form.name}
                id="save-partner-btn"
                onClick={handleSubmit}
              >
                {editingId ? "Update Partner" : "Create Partner"}
              </Button>
              <Button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="gap-2"
          id="add-partner-btn"
          onClick={() => setShowForm(true)}
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Add partner
        </Button>
      )}

      {/* Partners table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Partner Directory
          </CardTitle>
          <CardDescription>{initial.length} partners</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No partners yet. Add your first partner above.
                  </TableCell>
                </TableRow>
              ) : (
                initial.map((partner) => (
                  <TableRow key={partner.$id}>
                    <TableCell className="font-medium">
                      {partner.name}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        {partner.campus_id === "5" || !partner.campus_id ? (
                          <Globe className="h-3.5 w-3.5" />
                        ) : null}
                        {partner.campus_id
                          ? (CAMPUS_ID_TO_NAME[partner.campus_id] ??
                            partner.campus_id)
                          : "National"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {partner.website_url ? (
                        <a
                          className="text-primary text-sm hover:underline"
                          href={partner.website_url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Visit →
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          partner.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                        variant="outline"
                      >
                        {partner.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          className="h-7 w-7"
                          id={`edit-partner-${partner.$id}`}
                          onClick={() => handleEdit(partner)}
                          size="icon"
                          variant="ghost"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={isPending}
                          id={`delete-partner-${partner.$id}`}
                          onClick={() => handleDelete(partner.$id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
