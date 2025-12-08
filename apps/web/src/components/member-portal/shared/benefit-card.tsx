"use client";

import type { MemberBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
 Check,
 Clock,
 Copy,
 ExternalLink,
 QrCode,
 Store,
 Ticket,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/member-portal";

type BenefitCardProps = {
 benefit: MemberBenefit;
 isRevealed: boolean;
};

const getCategoryColor = (category: string) => {
 const colors: Record<string, string> = {
 "Food & Drink":
 "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
 Entertainment:
 "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
 "Health & Fitness":
 "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
 Career:
 "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
 Software:
 "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800",
 Travel:
 "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800",
 Education:
 "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
 };
 return (
 colors[category] ||
 "bg-muted text-muted-foreground border-border dark:bg-inverted dark:text-inverted-muted dark:border-border"
 );
};

const getBenefitIcon = (type: string) => {
 switch (type) {
 case "code":
 return Copy;
 case "qr":
 return QrCode;
 case "link":
 return ExternalLink;
 default:
 return Ticket;
 }
};

export function BenefitCard({
 benefit,
 isRevealed: initialRevealed,
}: BenefitCardProps) {
 const t = useTranslations("memberPortal.benefits");
 const [revealed, setRevealed] = useState(initialRevealed);
 const [value, setValue] = useState<string | null>(benefit.value || null);
 const [copiedCode, setCopiedCode] = useState(false);
 const [isRevealing, setIsRevealing] = useState(false);

 const Icon = getBenefitIcon(benefit.type);

 const handleReveal = async () => {
 if (revealed || isRevealing) {
 return;
 }

 setIsRevealing(true);
 try {
 const result = await revealBenefit(benefit.id);
 if (result?.success) {
 setRevealed(true);
 if (result.value) {
 setValue(result.value);
 }
 }
 } catch (error) {
 console.error("Failed to reveal benefit:", error);
 } finally {
 setIsRevealing(false);
 }
 };

 const handleCopyCode = () => {
 if (value) {
 navigator.clipboard.writeText(value);
 setCopiedCode(true);
 setTimeout(() => setCopiedCode(false), 2000);
 }
 };

 return (
 <Card className="border-0 p-6 shadow-lg transition-all hover:shadow-xl dark:bg-inverted/50 dark:backdrop-blur-sm">
 <div className="mb-4 flex items-start justify-between">
 <div className="flex flex-1 items-start gap-4">
 {benefit.partnerLogo ? (
 <Image
 alt={benefit.partner || ""}
 className="h-12 w-12 rounded-lg object-cover"
 fill
 src={benefit.partnerLogo}
 />
 ) : (
 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-muted dark:bg-brand-muted-strong">
 <Icon className="h-6 w-6 text-brand" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <h3 className="mb-1 truncate font-semibold text-foreground text-lg dark:text-foreground">
 {benefit.title}
 </h3>
 {benefit.partner && (
 <p className="flex items-center gap-1 text-muted-foreground text-sm dark:text-muted-foreground">
 <Store className="h-3 w-3" />
 {benefit.partner}
 </p>
 )}
 </div>
 </div>
 <Badge className={getCategoryColor(benefit.category)}>
 {benefit.category}
 </Badge>
 </div>

 <p className="mb-4 text-muted-foreground dark:text-muted-foreground">
 {benefit.description}
 </p>

 {benefit.type !== "text" && (
 <div className="mb-4">
 {!revealed && (
 <Button
 className="w-full"
 disabled={isRevealing}
 onClick={handleReveal}
 variant="outline"
 >
 <Icon className="mr-2 h-4 w-4" />
 {isRevealing ? "Revealing..." : t("reveal")}
 </Button>
 )}

 {revealed && benefit.type === "code" && value && (
 <div className="rounded-lg border-2 border-border border-dashed bg-section p-4 dark:border-border dark:bg-inverted">
 <div className="flex items-center justify-between">
 <code className="font-mono text-foreground text-lg dark:text-foreground">
 {value}
 </code>
 <Button onClick={handleCopyCode} size="sm" variant="outline">
 {copiedCode ? (
 <>
 <Check className="mr-2 h-4 w-4" />
 {t("copied")}
 </>
 ) : (
 <>
 <Copy className="mr-2 h-4 w-4" />
 {t("copy")}
 </>
 )}
 </Button>
 </div>
 </div>
 )}

 {revealed && benefit.type === "qr" && value && (
 <div className="flex justify-center rounded-lg bg-section p-6 dark:bg-inverted">
 <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-border bg-background dark:border-border dark:bg-inverted">
 {/* QR code would be rendered here with a library like qrcode.react */}
 <QrCode className="h-20 w-20 text-muted-foreground dark:text-muted-foreground" />
 </div>
 </div>
 )}

 {revealed && benefit.type === "link" && value && (
 <Button
 className="w-full"
 onClick={() => window.open(value, "_blank")}
 variant="outline"
 >
 <ExternalLink className="mr-2 h-4 w-4" />
 {t("activateBenefit")}
 </Button>
 )}
 </div>
 )}

 {benefit.terms && (
 <div className="border-t pt-3 text-muted-foreground text-xs dark:border-border dark:text-muted-foreground">
 <strong>{t("terms")}</strong> {benefit.terms}
 </div>
 )}

 {benefit.expiresAt && (
 <div className="mt-2 flex items-center gap-2 text-orange-600 text-xs dark:text-orange-400">
 <Clock className="h-3 w-3" />
 {t("expires", {
 date: new Date(benefit.expiresAt).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 }),
 })}
 </div>
 )}
 </Card>
 );
}
