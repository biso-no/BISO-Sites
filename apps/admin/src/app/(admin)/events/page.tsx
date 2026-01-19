import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { listEvents } from "@/app/actions/events";
import { EventsSummary } from "./events-metrics";
import { EventsTable } from "./events-table";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const tPromise = getTranslations("adminEvents"); // Start fetching translations
  const params = await searchParams;
  const campus = params.campus;
  const status = params.status || "all";
  const search = params.q;

  const eventsPromise = listEvents({ campus, status, search, limit: 200 });

  const t = await tPromise; // Wait for translations for the shell/static parts

  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-3xl bg-primary/5" />
        }
      >
        <EventsSummary eventsPromise={eventsPromise} />
      </Suspense>

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="font-semibold text-lg text-primary-100">
            {t("filterTitle")}
          </CardTitle>
          <CardDescription className="text-primary-60 text-sm">
            {t("filterDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40 md:col-span-2"
              defaultValue={search || ""}
              name="q"
              placeholder={t("searchPlaceholder")}
            />
            <Select defaultValue={status} name="status">
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                <SelectItem value="draft">{t("filters.draft")}</SelectItem>
                <SelectItem value="published">
                  {t("filters.published")}
                </SelectItem>
                <SelectItem value="cancelled">
                  {t("filters.cancelled")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40"
              defaultValue={campus || ""}
              name="campus"
              placeholder={t("filters.campus")}
            />
            <Button
              className="w-full rounded-xl bg-primary-40 font-semibold text-sm text-white shadow"
              type="submit"
            >
              {t("filters.filter")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-3xl bg-primary/5" />
        }
      >
        <EventsTable eventsPromise={eventsPromise} />
      </Suspense>
    </div>
  );
}
