import { Card } from "@repo/ui/components/ui/card";
import { CheckCircle, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";

type BenefitsSectionProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
  colorScheme: "blue" | "green" | "pink" | "purple" | "orange";
};

const colorSchemes = {
  blue: {
    gradient: "from-[#3DA9E0]/5 to-white",
    iconGradient: "from-[#3DA9E0] to-[#001731]",
    checkColor: "text-[#3DA9E0]",
  },
  green: {
    gradient: "from-green-50 to-white",
    iconGradient: "from-green-500 to-green-700",
    checkColor: "text-green-600",
  },
  pink: {
    gradient: "from-pink-50 to-white",
    iconGradient: "from-pink-500 to-rose-600",
    checkColor: "text-pink-600",
  },
  purple: {
    gradient: "from-blue-50 to-white",
    iconGradient: "from-blue-500 to-blue-700",
    checkColor: "text-blue-600",
  },
  orange: {
    gradient: "from-[#001731]/5 to-white",
    iconGradient: "from-[#001731] to-[#3DA9E0]",
    checkColor: "text-[#001731]",
  },
};

export function BenefitsSection({
  title,
  description,
  icon: Icon,
  items,
  colorScheme,
}: BenefitsSectionProps) {
  const colors = colorSchemes[colorScheme];

  return (
    <section>
      <Card
        className={`border-0 bg-linear-to-br p-8 shadow-xl ${colors.gradient}`}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className={`h-12 w-12 rounded-full bg-linear-to-br ${colors.iconGradient} flex items-center justify-center`}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 rounded-lg bg-background p-4"
              initial={{ opacity: 0, x: -20 }}
              key={index}
              transition={{ delay: index * 0.05 }}
            >
              <CheckCircle
                className={`h-5 w-5 ${colors.checkColor} mt-0.5 shrink-0`}
              />
              <span className="text-muted-foreground">{item}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </section>
  );
}
