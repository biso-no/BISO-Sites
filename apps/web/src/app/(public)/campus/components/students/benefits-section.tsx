import { motion } from "motion/react";
import { CheckCircle, type LucideIcon } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";

interface BenefitsSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
  colorScheme: "blue" | "green" | "pink" | "purple" | "orange";
}

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
      <Card className={`p-8 border-0 shadow-xl bg-gradient-to-br ${colors.gradient}`}>
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors.iconGradient} flex items-center justify-center`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-4 bg-white rounded-lg"
            >
              <CheckCircle className={`w-5 h-5 ${colors.checkColor} shrink-0 mt-0.5`} />
              <span className="text-gray-700">{item}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </section>
  );
}

