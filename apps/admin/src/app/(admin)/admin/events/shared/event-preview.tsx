"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { format } from "date-fns";
import { enUS, nb } from "date-fns/locale";
import { Calendar, Clock, MapPin, Ticket, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useMemo } from "react";

type EventFormData = {
  slug: string;
  status: "draft" | "published" | "cancelled";
  campus_id: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  price?: number;
  ticket_url?: string;
  image?: string;
  member_only?: boolean;
  metadata?: {
    start_time?: string;
    end_time?: string;
    images?: string[];
  };
  translations: {
    en: {
      title: string;
      description: string;
    };
    no: {
      title: string;
      description: string;
    };
  };
};

type EventPreviewProps = {
  data: EventFormData;
  locale: "en" | "no";
};

// Helper functions moved outside component to reduce complexity
const formatPrice = (price: number) =>
  new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (dateStr: string | undefined, locale: "en" | "no") => {
  if (!dateStr) {
    return null;
  }
  try {
    const date = new Date(dateStr);
    return format(date, "PPP", { locale: locale === "no" ? nb : enUS });
  } catch {
    return dateStr;
  }
};

const stripHtml = (html: string) => {
  // Only run in browser environment
  if (typeof window === "undefined") {
    return html;
  }
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

// Sub-components to reduce main component complexity
function StatusOverlay({ status }: { status: EventFormData["status"] }) {
  if (status === "published") {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 z-10">
      <Badge
        className="font-semibold text-xs uppercase"
        variant={status === "draft" ? "secondary" : "destructive"}
      >
        {status}
      </Badge>
    </div>
  );
}

function PriceBadge({ price, locale }: { price?: number; locale: "en" | "no" }) {
  if (price === undefined || price === null) {
    return null;
  }

  if (price === 0) {
    return (
      <div className="absolute right-3 bottom-3 rounded-full bg-green-500/90 px-3 py-1 backdrop-blur-sm">
        <span className="font-semibold text-sm text-white">
          {locale === "en" ? "Free" : "Gratis"}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute right-3 bottom-3 rounded-full bg-primary/90 px-3 py-1 backdrop-blur-sm">
      <span className="font-semibold text-sm text-white">
        {formatPrice(price)}
      </span>
    </div>
  );
}

function MemberBadge({
  memberOnly,
  locale,
}: {
  memberOnly?: boolean;
  locale: "en" | "no";
}) {
  if (!memberOnly) {
    return null;
  }

  return (
    <div className="absolute top-3 left-3">
      <Badge className="border-blue-200 bg-blue-50 font-medium text-blue-700">
        <Users className="mr-1 h-3 w-3" />
        {locale === "en" ? "Members Only" : "Kun medlemmer"}
      </Badge>
    </div>
  );
}

function EventImage({
  data,
  locale,
  imageUrl,
  title,
}: {
  data: EventFormData;
  locale: "en" | "no";
  imageUrl: string;
  title: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
      <Image
        alt={title || "Event preview"}
        className="object-cover"
        fill
        sizes="400px"
        src={imageUrl}
      />
      <MemberBadge memberOnly={data.member_only} locale={locale} />
      <PriceBadge price={data.price} locale={locale} />
    </div>
  );
}

function EventInfo({
  data,
  locale,
  translation,
  shortDescription,
}: {
  data: EventFormData;
  locale: "en" | "no";
  translation: { title: string };
  shortDescription: string;
}) {
  return (
    <div className="space-y-3 p-4">
      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-gray-900 text-lg">
        {translation.title ||
          (locale === "en" ? "Event Title" : "Arrangementstittel")}
      </h3>

      {/* Date & Time */}
      {data.start_date && (
        <div className="flex items-start gap-2 text-gray-600 text-sm">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div>{formatDate(data.start_date, locale)}</div>
            {(data.metadata?.start_time || data.metadata?.end_time) && (
              <div className="mt-1 flex items-center gap-1 text-gray-500 text-xs">
                <Clock className="h-3 w-3" />
                {data.metadata.start_time}
                {data.metadata.end_time && ` - ${data.metadata.end_time}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {data.location && (
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="line-clamp-1">{data.location}</span>
        </div>
      )}

      {/* Description */}
      <p className="line-clamp-3 text-gray-600 text-sm">
        {shortDescription ||
          (locale === "en"
            ? "Event description..."
            : "Arrangementbeskrivelse...")}
      </p>

      {/* Ticket Link */}
      {data.ticket_url && (
        <div className="flex items-center gap-2 border-t pt-2">
          <Badge className="text-xs" variant="outline">
            <Ticket className="mr-1 h-3 w-3" />
            {locale === "en" ? "Tickets Available" : "Billetter tilgjengelig"}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function EventPreview({ data, locale }: EventPreviewProps) {
  const translation = data.translations[locale];
  const imageUrl =
    data.metadata?.images?.[0] || data.image || "/images/placeholder.jpg";

  const shortDescription = useMemo(() => {
    if (!translation.description) {
      return "";
    }
    const plainText = stripHtml(translation.description);
    return plainText.length > 150
      ? `${plainText.substring(0, 150)}...`
      : plainText;
  }, [translation.description]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="relative"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <StatusOverlay status={data.status} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
        <EventImage
          data={data}
          locale={locale}
          imageUrl={imageUrl}
          title={translation.title}
        />
        <EventInfo
          data={data}
          locale={locale}
          translation={translation}
          shortDescription={shortDescription}
        />
      </div>

      <p className="mt-2 text-center text-muted-foreground text-xs italic">
        {locale === "en" ? "Live Preview" : "Forhåndsvisning"}
      </p>
    </motion.div>
  );
}
