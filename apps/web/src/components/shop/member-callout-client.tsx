"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Users } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

export function MemberCalloutClient() {
  const router = useRouter();

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      initial={{ opacity: 0, x: 20 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="border-0 bg-linear-to-br from-orange-50 to-yellow-50 p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <h4 className="mb-2 font-semibold text-foreground">
              Not a member yet?
            </h4>
            <p className="mb-3 text-muted-foreground text-sm">
              Join BISO from just 350 NOK/semester and enjoy:
            </p>
            <ul className="space-y-1 text-muted-foreground text-sm">
              <li>✓ Discounts on all shop items</li>
              <li>✓ Member-only events</li>
              <li>✓ Priority registration</li>
              <li>✓ Partner discounts</li>
            </ul>
            <p className="mt-2 mb-3 text-muted-foreground text-xs">
              💡 Best value: Year membership 550 NOK | 3-year 1200 NOK
            </p>
            <Button
              className="mt-2 w-full border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => router.push("/shop?category=Membership")}
              size="sm"
              variant="outline"
            >
              Become a Member
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
