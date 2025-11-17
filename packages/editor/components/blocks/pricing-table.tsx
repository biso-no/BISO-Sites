import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Check, X } from "lucide-react";
import type { PricingTableBlockProps } from "../../types";

export function PricingTable({
  id,
  tiers,
  heading,
  description,
}: PricingTableBlockProps) {
  return (
    <div id={id} className="max-w-7xl mx-auto">
      {(heading || description) && (
        <div className="text-center mb-16">
          {heading && (
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {heading}
            </h2>
          )}
          {description && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{description}</p>
          )}
        </div>
      )}

      <div className={cn(
        "grid gap-8",
        tiers.length === 2 ? "md:grid-cols-2 max-w-4xl mx-auto" : "md:grid-cols-3"
      )}>
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={cn(
              "relative p-8 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col",
              tier.popular && "ring-2 ring-[#3DA9E0] transform scale-105"
            )}
          >
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white px-6 py-2 rounded-full shadow-lg text-sm font-medium">
                  Most Popular
                </div>
              </div>
            )}

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-4 text-gray-900">{tier.name}</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
              </div>
              {tier.period && <p className="text-gray-600">{tier.period}</p>}
            </div>

            <div className="space-y-3 mb-8 grow">
              {tier.features.map((feature) => (
                <div key={feature.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                      feature.included
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {feature.included ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      feature.included ? "text-gray-700" : "text-gray-400 line-through"
                    )}
                  >
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>

            {tier.buttonLabel && (
              <Button
                asChild
                className={cn(
                  "w-full",
                  tier.popular
                    ? "bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:opacity-90 text-white border-0"
                    : ""
                )}
              >
                <a href={tier.buttonHref || "#"}>{tier.buttonLabel}</a>
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

