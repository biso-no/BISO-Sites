"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Download, FileText } from "lucide-react";
import { motion } from "motion/react";

interface PdfCtaProps {
  description: string;
  href: string;
  title: string;
}

export function PdfCta({ title, description, href }: PdfCtaProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-muted">
            <FileText className="h-6 w-6 text-brand-dark" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <Button
          asChild
          className="shrink-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md hover:opacity-90"
        >
          <a href={href} rel="noopener noreferrer" target="_blank">
            <Download className="mr-2 h-4 w-4" />
            PDF
          </a>
        </Button>
      </Card>
    </motion.div>
  );
}
