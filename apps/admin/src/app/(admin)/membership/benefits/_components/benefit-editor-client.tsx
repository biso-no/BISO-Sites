"use client";

import type { BenefitPartner, CampusBenefit } from "@repo/api/types/appwrite";
import { BenefitStatus } from "@repo/api/types/appwrite";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  Save,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BENEFIT_CATEGORIES } from "@repo/shared/utils/benefit-scope";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import {
  createBenefit,
  publishBenefit,
  updateBenefit,
  type CreateBenefitInput,
} from "@/app/actions/benefits";

interface BenefitEditorClientProps {
  benefit: CampusBenefit | null;
  defaultCampusId: string;
  managedCampusIds: string[];
  partners: BenefitPartner[];
}

export function BenefitEditorClient({
  benefit,
  defaultCampusId,
  managedCampusIds,
  partners,
}: BenefitEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<CreateBenefitInput>({
    campus_id: benefit?.campus_id ?? defaultCampusId,
    status: benefit?.status ?? BenefitStatus.DRAFT,
    kind: benefit?.kind ?? "offer",
    redemption_type: benefit?.redemption_type ?? "none",
    category: benefit?.category ?? "Career",
    partner_id: benefit?.partner_id ?? null,
    partner_name: benefit?.partner_name ?? null,
    partner_logo_url: benefit?.partner_logo_url ?? null,
    title_nb: benefit?.title_nb ?? "",
    title_en: benefit?.title_en ?? "",
    description_nb: benefit?.description_nb ?? "",
    description_en: benefit?.description_en ?? "",
    teaser_nb: benefit?.teaser_nb ?? null,
    teaser_en: benefit?.teaser_en ?? null,
    terms_nb: benefit?.terms_nb ?? null,
    terms_en: benefit?.terms_en ?? null,
    redemption_value: benefit?.redemption_value ?? null,
    image_url: benefit?.image_url ?? null,
    is_featured: benefit?.is_featured ?? false,
    is_member_only: benefit?.is_member_only ?? true,
    publish_start: benefit?.publish_start ?? null,
    publish_end: benefit?.publish_end ?? null,
    sort_order: benefit?.sort_order ?? 0,
  });

  const handleSave = (publish = false) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        if (
          !form.title_nb ||
          !form.title_en ||
          !form.description_nb ||
          !form.description_en
        ) {
          setError(
            "Please fill in all required fields (titles and descriptions in both languages)."
          );
          return;
        }

        if (benefit) {
          await updateBenefit(benefit.$id, form);
          if (publish) await publishBenefit(benefit.$id);
          setSuccess(publish ? "Published successfully!" : "Benefit updated.");
        } else {
          const created = await createBenefit({
            ...form,
            status: publish ? BenefitStatus.PUBLISHED : BenefitStatus.DRAFT,
          });
          if (publish && created.$id) await publishBenefit(created.$id);
          setSuccess(
            publish ? "Benefit published!" : "Benefit created as draft."
          );
          router.push(`/membership/benefits/${created.$id}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save benefit.");
      }
    });
  };

  const handlePartnerSelect = (partnerId: string) => {
    if (partnerId === "none") {
      setForm((prev) => ({
        ...prev,
        partner_id: null,
        partner_name: null,
        partner_logo_url: null,
      }));
      return;
    }
    const partner = partners.find((p) => p.$id === partnerId);
    if (partner) {
      setForm((prev) => ({
        ...prev,
        partner_id: partner.$id,
        partner_name: partner.name,
        partner_logo_url: partner.logo_url ?? null,
      }));
    }
  };

  const isPublished = benefit?.status === BenefitStatus.PUBLISHED;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main editor */}
      <div className="space-y-6 lg:col-span-2">
        {/* Content — Norwegian */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Content (Norwegian)</CardTitle>
            <CardDescription>
              Primary language for the BISO audience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title-nb">Title (Norwegian) *</Label>
              <Input
                id="title-nb"
                placeholder="f.eks. 20% rabatt på Kaffebrenneriet"
                value={form.title_nb}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title_nb: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description-nb">Description (Norwegian) *</Label>
              <Textarea
                id="description-nb"
                rows={4}
                placeholder="Beskriv fordelen for studenter..."
                value={form.description_nb}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description_nb: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teaser-nb">Teaser (Norwegian)</Label>
              <Input
                id="teaser-nb"
                placeholder="Kort oppsummering for ikke-medlemmer..."
                value={form.teaser_nb ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, teaser_nb: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="terms-nb">Terms & Conditions (Norwegian)</Label>
              <Textarea
                id="terms-nb"
                rows={2}
                placeholder="Gyldige vilkår..."
                value={form.terms_nb ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, terms_nb: e.target.value || null }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Content — English */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Content (English)</CardTitle>
            <CardDescription>
              English version for international students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title-en">Title (English) *</Label>
              <Input
                id="title-en"
                placeholder="e.g. 20% off at Kaffebrenneriet"
                value={form.title_en}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title_en: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description-en">Description (English) *</Label>
              <Textarea
                id="description-en"
                rows={4}
                placeholder="Describe the benefit for students..."
                value={form.description_en}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description_en: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teaser-en">Teaser (English)</Label>
              <Input
                id="teaser-en"
                placeholder="Short preview for non-members..."
                value={form.teaser_en ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, teaser_en: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="terms-en">Terms & Conditions (English)</Label>
              <Textarea
                id="terms-en"
                rows={2}
                placeholder="Applicable terms..."
                value={form.terms_en ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, terms_en: e.target.value || null }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Redemption */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Redemption</CardTitle>
            <CardDescription>How members access this benefit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="redemption-type">Redemption Type</Label>
                <Select
                  value={form.redemption_type}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      redemption_type: v as typeof form.redemption_type,
                    }))
                  }
                >
                  <SelectTrigger id="redemption-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (info only)</SelectItem>
                    <SelectItem value="code">Discount Code</SelectItem>
                    <SelectItem value="link">Link (URL)</SelectItem>
                    <SelectItem value="qr">QR Code</SelectItem>
                    <SelectItem value="onsite">On-site / In-person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.redemption_type !== "none" &&
                form.redemption_type !== "onsite" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="redemption-value">
                      {form.redemption_type === "code"
                        ? "Discount Code"
                        : "URL / Value"}
                    </Label>
                    <Input
                      id="redemption-value"
                      placeholder={
                        form.redemption_type === "code"
                          ? "e.g. BISO20"
                          : "https://partner.com/student"
                      }
                      value={form.redemption_value ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          redemption_value: e.target.value || null,
                        }))
                      }
                    />
                  </div>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="publish-start">Available From</Label>
                <Input
                  id="publish-start"
                  type="datetime-local"
                  value={form.publish_start?.slice(0, 16) ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      publish_start: e.target.value
                        ? `${e.target.value}:00.000Z`
                        : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="publish-end">Expires On</Label>
                <Input
                  id="publish-end"
                  type="datetime-local"
                  value={form.publish_end?.slice(0, 16) ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      publish_end: e.target.value
                        ? `${e.target.value}:00.000Z`
                        : null,
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar settings */}
      <div className="space-y-6">
        {/* Feedback */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-destructive text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Publish actions */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  form.status === "published"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                }
              >
                {form.status}
              </Badge>
            </div>
            <Button
              id="save-draft-btn"
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() => handleSave(false)}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save as draft
            </Button>
            <Button
              id="publish-btn"
              className="w-full"
              disabled={isPending || isPublished}
              onClick={() => handleSave(true)}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {isPublished ? "Published" : "Publish now"}
            </Button>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campus-select">Campus</Label>
              <Select
                value={form.campus_id}
                onValueChange={(v) => setForm((p) => ({ ...p, campus_id: v }))}
              >
                <SelectTrigger id="campus-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Global admins see all campuses incl. National */}
                  {managedCampusIds.includes("5") ||
                  managedCampusIds.length === 0 ? (
                    <>
                      <SelectItem value="5">
                        <span className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5" />
                          National
                        </span>
                      </SelectItem>
                      {["1", "2", "3", "4"].map((id) => (
                        <SelectItem key={id} value={id}>
                          {CAMPUS_ID_TO_NAME[id]}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    managedCampusIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {CAMPUS_ID_TO_NAME[id] ?? id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kind-select">Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, kind: v as typeof form.kind }))
                }
              >
                <SelectTrigger id="kind-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">
                    Offer (% or value discount)
                  </SelectItem>
                  <SelectItem value="perk">Perk (member exclusive)</SelectItem>
                  <SelectItem value="service">
                    Service (access/resource)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-select">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger id="category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partner-select">Partner</Label>
              <Select
                value={form.partner_id ?? "none"}
                onValueChange={handlePartnerSelect}
              >
                <SelectTrigger id="partner-select">
                  <SelectValue placeholder="No partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No partner</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.$id} value={p.$id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://..."
                value={form.image_url ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, image_url: e.target.value || null }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sort-order">Sort Order</Label>
              <Input
                id="sort-order"
                type="number"
                min="0"
                max="9999"
                value={form.sort_order ?? 0}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))
                }
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 border-t pt-3">
              <button
                type="button"
                id="featured-toggle"
                onClick={() =>
                  setForm((p) => ({ ...p, is_featured: !p.is_featured }))
                }
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  form.is_featured
                    ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <Star
                  className={`h-4 w-4 ${form.is_featured ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">Featured</p>
                  <p className="text-muted-foreground text-xs">
                    Show prominently on portal
                  </p>
                </div>
                {form.is_featured && (
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                )}
              </button>

              <button
                type="button"
                id="member-only-toggle"
                onClick={() =>
                  setForm((p) => ({ ...p, is_member_only: !p.is_member_only }))
                }
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  form.is_member_only
                    ? "border-primary/20 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <X className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Members Only</p>
                  <p className="text-muted-foreground text-xs">
                    Hide redemption value from guests
                  </p>
                </div>
                {form.is_member_only && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
