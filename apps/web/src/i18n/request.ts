import { loadMessages } from "@repo/i18n/messages";
import { getRequestConfig } from "next-intl/server";
import { getLocale } from "@/app/actions/locale";

export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    locale,
    messages: await loadMessages(locale),
    // BISO is Oslo-based. Without this, dates format in the runtime's zone:
    // UTC on the server (2 hours early in summer) and the browser's zone on
    // the client.
    timeZone: "Europe/Oslo",
  };
});
