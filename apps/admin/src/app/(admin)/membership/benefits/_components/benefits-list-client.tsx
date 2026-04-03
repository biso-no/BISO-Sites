"use client";

import type { CampusBenefit } from "@repo/api/types/appwrite";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Archive,
  CheckCircle,
  Copy,
  Edit,
  Gift,
  Globe,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveBenefit,
  deleteBenefit,
  duplicateBenefit,
  publishBenefit,
} from "@/app/actions/benefits";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  published: {
    label: "Published",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  draft: {
    label: "Draft",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const KIND_STYLES: Record<string, string> = {
  offer: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  perk: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  service: "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
};

type BenefitsListClientProps = {
  benefits: CampusBenefit[];
  total: number;
};

export function BenefitsListClient({
  benefits: initial,
  total,
}: BenefitsListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const filtered = initial.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.title_en.toLowerCase().includes(q) ||
      b.title_nb.toLowerCase().includes(q) ||
      (b.partner_name ?? "").toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: initial.length,
    published: initial.filter((b) => b.status === BenefitStatus.PUBLISHED)
      .length,
    draft: initial.filter((b) => b.status === BenefitStatus.DRAFT).length,
    archived: initial.filter((b) => b.status === BenefitStatus.ARCHIVED).length,
  };

  const handleAction = (id: string, fn: () => Promise<unknown>) => {
    setActiveActionId(id);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } finally {
        setActiveActionId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["all", "published", "draft", "archived"] as const).map((status) => (
          <button
            key={status}
            type="button"
            id={`filter-${status}`}
            onClick={() => setStatusFilter(status)}
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === status
                ? "border-primary bg-primary/5 shadow-inner"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <p className="font-bold text-2xl">
              {counts[status as keyof typeof counts]}
            </p>
            <p className="text-muted-foreground text-sm capitalize">{status}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          id="benefit-search"
          placeholder="Search benefits..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Benefits Catalog
          </CardTitle>
          <CardDescription>
            {filtered.length} of {total} benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefit</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No benefits found. Create your first benefit to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((benefit) => {
                  const statusStyle =
                    STATUS_STYLES[benefit.status] ?? STATUS_STYLES.draft;
                  const isActive = activeActionId === benefit.$id;
                  return (
                    <TableRow
                      key={benefit.$id}
                      className={isActive ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {benefit.is_featured && (
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium">{benefit.title_en}</p>
                            <p className="text-muted-foreground text-xs">
                              {benefit.title_nb}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          {benefit.campus_id === "5" ? (
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : null}
                          {CAMPUS_ID_TO_NAME[benefit.campus_id] ??
                            benefit.campus_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {benefit.category}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={KIND_STYLES[benefit.kind]}
                        >
                          {benefit.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusStyle.className}
                        >
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Edit"
                            id={`edit-benefit-${benefit.$id}`}
                            onClick={() =>
                              router.push(`/membership/benefits/${benefit.$id}`)
                            }
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {benefit.status !== BenefitStatus.PUBLISHED && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                              title="Publish"
                              id={`publish-benefit-${benefit.$id}`}
                              disabled={isActive || isPending}
                              onClick={() =>
                                handleAction(benefit.$id, () =>
                                  publishBenefit(benefit.$id)
                                )
                              }
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {benefit.status !== BenefitStatus.ARCHIVED && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              title="Archive"
                              id={`archive-benefit-${benefit.$id}`}
                              disabled={isActive || isPending}
                              onClick={() =>
                                handleAction(benefit.$id, () =>
                                  archiveBenefit(benefit.$id)
                                )
                              }
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Duplicate"
                            id={`duplicate-benefit-${benefit.$id}`}
                            disabled={isActive || isPending}
                            onClick={() =>
                              handleAction(benefit.$id, () =>
                                duplicateBenefit(benefit.$id)
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
