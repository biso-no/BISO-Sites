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
    if (!form.name) return;
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
              size="icon"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
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
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Kaffebrenneriet"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-website">Website URL</Label>
                <Input
                  id="partner-website"
                  value={form.website_url}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, website_url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-logo">Logo URL</Label>
                <Input
                  id="partner-logo"
                  value={form.logo_url}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, logo_url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-campus">Campus (scope)</Label>
                <select
                  id="partner-campus"
                  value={form.campus_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, campus_id: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
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
                  value={form.description_nb}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description_nb: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="partner-desc-en">Description (English)</Label>
                <Input
                  id="partner-desc-en"
                  value={form.description_en}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description_en: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                id="save-partner-btn"
                onClick={handleSubmit}
                disabled={isPending || !form.name}
              >
                {editingId ? "Update Partner" : "Create Partner"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          id="add-partner-btn"
          onClick={() => setShowForm(true)}
          variant="outline"
          className="gap-2"
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
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
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
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
                          href={partner.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-sm hover:underline"
                        >
                          Visit →
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          partner.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {partner.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          id={`edit-partner-${partner.$id}`}
                          onClick={() => handleEdit(partner)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          id={`delete-partner-${partner.$id}`}
                          disabled={isPending}
                          onClick={() => handleDelete(partner.$id)}
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
