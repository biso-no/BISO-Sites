"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Award, Calendar, Heart, Users } from "lucide-react";
import { motion } from "motion/react";
import type { DepartmentTranslation } from "@/lib/actions/departments";

type OverviewTabProps = {
 department: DepartmentTranslation;
};

export function OverviewTab({ department }: OverviewTabProps) {
 const dept = department.department_ref;
 const news = department.news || [];

 return (
 <div className="space-y-12">
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 20 }}
 >
 <Card className="border-0 bg-linear-to-br from-brand-muted to-card p-8 shadow-xl dark:from-brand-muted">
 <h2 className="mb-6 font-bold text-3xl text-foreground">
 About {department.title}
 </h2>
 <p className="mb-6 text-lg text-muted-foreground leading-relaxed">
 {department.description}
 </p>

 <div className="mt-8 grid gap-6 md:grid-cols-3">
 <div className="rounded-lg border border-brand-border bg-card p-6 text-center">
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
 <Award className="h-8 w-8 text-white" />
 </div>
 <h3 className="mb-2 font-bold text-2xl text-foreground">
 {news.length}+
 </h3>
 <p className="text-muted-foreground">Events Organized</p>
 </div>

 <div className="rounded-lg border border-brand-border bg-card p-6 text-center">
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
 <Users className="h-8 w-8 text-white" />
 </div>
 <h3 className="mb-2 font-bold text-2xl text-foreground">
 {dept.boardMembers?.length || 0}
 </h3>
 <p className="text-muted-foreground">Team Members</p>
 </div>

 <div className="rounded-lg border border-brand-border bg-card p-6 text-center">
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
 <Heart className="h-8 w-8 text-white" />
 </div>
 <h3 className="mb-2 font-bold text-2xl text-foreground">1000+</h3>
 <p className="text-muted-foreground">Students Reached</p>
 </div>
 </div>
 </Card>
 </motion.div>

 {/* Latest Highlights */}
 {news.length > 0 && (
 <section>
 <h2 className="mb-8 font-bold text-3xl text-foreground">
 Recent Highlights
 </h2>
 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
 {news.slice(0, 3).map((newsItem, index) => (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 20 }}
 key={newsItem.$id}
 transition={{ delay: index * 0.1 }}
 >
 <Card className="group cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
 <div className="relative h-48 overflow-hidden">
 {newsItem.news_ref?.image && (
 <ImageWithFallback
 alt={newsItem.title || "News"}
 className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
 fill
 src={newsItem.news_ref.image}
 />
 )}
 <Badge className="absolute top-4 right-4 border-0 bg-brand text-white">
 News
 </Badge>
 </div>
 <div className="p-6">
 <div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
 <Calendar className="h-4 w-4 text-brand" />
 {new Date(
 newsItem.news_ref?.$createdAt || newsItem.$createdAt
 ).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 })}
 </div>
 <h3 className="mb-2 font-semibold text-foreground text-lg transition-colors group-hover:text-brand">
 {newsItem.title || "Untitled"}
 </h3>
 <p className="line-clamp-2 text-muted-foreground text-sm">
 {newsItem.short_description || newsItem.description || ""}
 </p>
 </div>
 </Card>
 </motion.div>
 ))}
 </div>
 </section>
 )}
 </div>
 );
}
