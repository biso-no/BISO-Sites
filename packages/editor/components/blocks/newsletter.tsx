import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Mail } from "lucide-react";
import type { NewsletterBlockProps, SectionBackground } from "../../types";

const backgroundMap: Record<SectionBackground, string> = {
  default: "bg-white text-slate-900",
  muted: "bg-slate-100 text-slate-900",
  primary: "bg-linear-to-br from-[#3DA9E0] to-[#001731] text-white",
};

export function Newsletter({
  id,
  heading,
  description,
  placeholder = "Enter your email",
  buttonLabel = "Subscribe",
  privacyNotice,
  background = "primary",
}: NewsletterBlockProps) {
  const isPrimary = background === "primary";

  return (
    <Card
      id={id}
      className={cn(
        "p-12 border-0 shadow-xl max-w-2xl mx-auto",
        backgroundMap[background]
      )}
    >
      <div className="text-center mb-8">
        <div className={cn(
          "w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center",
          isPrimary ? "bg-white/20" : "bg-primary/10"
        )}>
          <Mail className={cn("w-8 h-8", isPrimary ? "text-white" : "text-primary")} />
        </div>

        <h2 className={cn("text-3xl font-bold mb-4", isPrimary ? "text-white" : "text-gray-900")}>
          {heading}
        </h2>
        {description && (
          <p className={cn("text-lg", isPrimary ? "text-white/90" : "text-gray-600")}>
            {description}
          </p>
        )}
      </div>

      <form className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder={placeholder}
            required
            className={cn(
              "flex-1",
              isPrimary && "bg-white/10 border-white/20 text-white placeholder:text-white/60"
            )}
          />
          <Button
            type="submit"
            size="lg"
            className={cn(
              isPrimary
                ? "bg-white text-[#001731] hover:bg-gray-100"
                : "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {buttonLabel}
          </Button>
        </div>

        {privacyNotice && (
          <p className={cn("text-xs text-center", isPrimary ? "text-white/70" : "text-gray-500")}>
            {privacyNotice}
          </p>
        )}
      </form>
    </Card>
  );
}

