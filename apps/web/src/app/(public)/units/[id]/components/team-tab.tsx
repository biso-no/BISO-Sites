"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ChevronRight, Linkedin, Mail, Users } from "lucide-react";
import { motion } from "motion/react";
import type { DepartmentTranslation } from "@/lib/actions/departments";

interface TeamTabProps {
  department: DepartmentTranslation;
}

export function TeamTab({ department }: TeamTabProps) {
  const dept = department.department_ref;
  const boardMembers = dept.boardMembers || [];

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-foreground mb-4">Meet Our Team</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Passionate students dedicated to creating amazing experiences for the BISO community
        </p>
      </motion.div>

      {boardMembers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {boardMembers.map((member, index) => (
            <motion.div
              key={member.$id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all text-center group">
                <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-[#3DA9E0]/20 group-hover:ring-[#3DA9E0] transition-all">
                  <AvatarImage src={member.imageUrl || undefined} alt={member.name || ""} />
                  <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-white text-2xl">
                    {member.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold text-foreground mb-1">{member.name}</h3>
                <p className="text-[#3DA9E0] mb-4">{member.role}</p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                  >
                    <Linkedin className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-0 shadow-lg">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Team Members Yet</h3>
          <p className="text-muted-foreground">Team information will be available soon.</p>
        </Card>
      )}

      {/* Join CTA */}
      <Card className="p-12 text-center border-0 shadow-xl bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 dark:from-[#3DA9E0]/20 dark:to-[#001731]/20">
        <Users className="w-16 h-16 text-[#3DA9E0] mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-foreground mb-4">Want to Join Our Team?</h3>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          We're always looking for passionate students to join {department.title}. Check out our
          open positions and be part of something amazing!
        </p>
        <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
          View Open Positions
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    </div>
  );
}
