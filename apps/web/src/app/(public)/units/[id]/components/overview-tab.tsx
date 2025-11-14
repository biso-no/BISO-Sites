"use client";

import { motion } from "motion/react";
import { Award, Users, Heart, Calendar } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { ImageWithFallback } from "@repo/ui/components/image";
import { DepartmentTranslation } from "@/lib/actions/departments";

interface OverviewTabProps {
  department: DepartmentTranslation;
}

export function OverviewTab({ department }: OverviewTabProps) {
  const dept = department.department_ref;
  const news = department.news || [];
  
  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-8 border-0 shadow-xl bg-linear-to-br from-[#3DA9E0]/5 to-card dark:from-[#3DA9E0]/10">
          <h2 className="text-3xl font-bold text-foreground mb-6">About {department.title}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            {department.description}
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="text-center p-6 rounded-lg bg-card border border-[#3DA9E0]/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {news.length}+
              </h3>
              <p className="text-muted-foreground">Events Organized</p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-card border border-[#3DA9E0]/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {dept.boardMembers?.length || 0}
              </h3>
              <p className="text-muted-foreground">Team Members</p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-card border border-[#3DA9E0]/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">1000+</h3>
              <p className="text-muted-foreground">Students Reached</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Latest Highlights */}
      {news.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold text-foreground mb-8">Recent Highlights</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.slice(0, 3).map((newsItem, index) => (
              <motion.div
                key={newsItem.$id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                >
                  <div className="relative h-48 overflow-hidden">
                    {newsItem.news_ref?.image && (
                      <ImageWithFallback
                        src={newsItem.news_ref.image}
                        alt={newsItem.title || 'News'}
                        fill
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    )}
                    <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                      News
                    </Badge>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                      {new Date(newsItem.news_ref?.$createdAt || newsItem.$createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-[#3DA9E0] transition-colors">
                      {newsItem.title || 'Untitled'}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {newsItem.short_description || newsItem.description || ''}
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
