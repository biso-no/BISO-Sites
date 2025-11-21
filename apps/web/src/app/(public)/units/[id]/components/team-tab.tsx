"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ChevronRight, Linkedin, Mail, Users } from "lucide-react";
import { motion } from "motion/react";
import type { DepartmentTranslation } from "@/lib/actions/departments";

type TeamTabProps = {
  department: DepartmentTranslation;
};

export function TeamTab({ department }: TeamTabProps) {
  const dept = department.department_ref;
  const boardMembers = dept.boardMembers || [];

  return (
    <div className="space-y-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground">
          Meet Our Team
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Passionate students dedicated to creating amazing experiences for the
          BISO community
        </p>
      </motion.div>

      {boardMembers.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {boardMembers.map((member, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              key={member.$id}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="group border-0 p-6 text-center shadow-lg transition-all hover:shadow-xl">
                <Avatar className="mx-auto mb-4 h-32 w-32 ring-4 ring-[#3DA9E0]/20 transition-all group-hover:ring-[#3DA9E0]">
                  <AvatarImage
                    alt={member.name || ""}
                    src={member.imageUrl || undefined}
                  />
                  <AvatarFallback className="bg-linear-to-br from-[#3DA9E0] to-[#001731] text-2xl text-white">
                    {member.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mb-1 font-semibold text-foreground text-lg">
                  {member.name}
                </h3>
                <p className="mb-4 text-[#3DA9E0]">{member.role}</p>
                <div className="flex justify-center gap-3">
                  <Button
                    className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                    size="sm"
                    variant="outline"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
                    size="sm"
                    variant="outline"
                  >
                    <Linkedin className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-0 p-12 text-center shadow-lg">
          <Users className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-foreground text-xl">
            No Team Members Yet
          </h3>
          <p className="text-muted-foreground">
            Team information will be available soon.
          </p>
        </Card>
      )}

      {/* Join CTA */}
      <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 p-12 text-center shadow-xl dark:from-[#3DA9E0]/20 dark:to-[#001731]/20">
        <Users className="mx-auto mb-6 h-16 w-16 text-[#3DA9E0]" />
        <h3 className="mb-4 font-bold text-2xl text-foreground">
          Want to Join Our Team?
        </h3>
        <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
          We're always looking for passionate students to join{" "}
          {department.title}. Check out our open positions and be part of
          something amazing!
        </p>
        <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
          View Open Positions
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </Card>
    </div>
  );
}
