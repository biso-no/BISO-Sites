/**
 * Sales type per existing webshop product, as agreed on 2026-09-11 (see the
 * Finago shop ledger posting spec). Edit the Varesalg bucket before applying if
 * the accountant books sweaters, vests or the camera sale differently.
 */
export const PRODUCT_SALES_TYPES: Readonly<Record<string, readonly string[]>> =
  {
    egenandel: [
      "wpprod65895", // Avslutningsfest 23. mai
      "wpprod65721", // Blåtur (Bergensbaneløpet hyttetur)
      "wpprod65640", // Blåtur NU
      "wpprod63922", // Børsgruppen — egenandel reise
      "wpprod65436", // Delbetaling 2 ØKAD linjetur
      "wpprod65435", // Styret ØKAD linjetur
      "wpprod65894", // egenadel hyttetur fadderullan
      "wpprod65571", // Egenandel hyttetur Karrieredagene
      "wpprod65722", // KD hyttetur egenandel
      "wpprod64919", // NU hyttetur Trysil
      "wpprod64111", // Hyttetur Makroøkonomisk utvalg – Hemsedal
      "wpprod65946", // overlapstur
      "wpprod65890", // Egenandel Overlapps tur Stavanger
      "wpprod63914", // Egenandel – Investment
      "wpprod65918", // Ownshare debate
      "wpprod65025", // Linjetur forretningsjus
      "wpprod65744", // innbetaling forretningsjus
      "wpprod65346", // Utenlandstur HR delbetaling 1
      "wpprod65504", // Finans & HR linjetur Milano 2026 delbetaling 2
      "wpprod65558", // HR linjetur Milano 2026
      "wpprod63535", // Payment 1 – ownshare – HR to Paris
      "wpprod63959", // Payment 2 – ownshare – HR to Paris
      "wpprod66774", // EMS Linjetur Styret (draft)
      "wpprod66775", // EMS Linjetur Styret 2 (draft)
      "wpprod7000", // Extra fee for individual hotel room (draft)
      "wpprod65891", // Oliver Wolt — personal deductible
      // Bergensbaneløpet personal deductibles
      "wpprod65835",
      "wpprod65824",
      "wpprod65820",
      "wpprod65830",
      "wpprod65823",
      "wpprod65833",
      "wpprod65826",
      "wpprod65819",
      "wpprod65822",
      "wpprod65825",
      "wpprod65829",
      "wpprod65831",
      "wpprod65832",
      "wpprod65821",
      "wpprod65827",
      "wpprod65828",
    ],
    varesalg: [
      "wpprod65924", // Gensere til børsgruppen
      "wpprod61903", // Sivøk genser (S)
      "wpprod61904", // Sivøk genser (M)
      "wpprod61905", // Sivøk genser (L)
      "wpprod61906", // Sivøk genser (XL)
      "wpprod61050", // Egenandel – BISO genser Trondheim 2025
      "wpprod64373", // Egenandel – BISO vester Trondheim 2025
      "wpprod65803", // Egenandel Vest Stavanger
      "wpprod64522", // Egenandel – Regnskaps-halvglidelås
      "wpprod65812", // salg av kamera – biso media
    ],
    bokskapleie: [
      "wpprod6833", // Bokskap – Campus Trondheim
      "wpprod37313", // Booklocker – Campus Oslo (Se beskrivelse)
      "wpprod6814", // Booklocker – Campus Oslo (Les beskrivelse)
    ],
    "annet-avgiftsfritt": [
      "wpprod65811", // Bot etter tur
    ],
  };

export const PRODUCTS_TO_ARCHIVE: readonly string[] = [
  "wpprod32094", // BISO Membership — legacy WordPress draft
  "6aa124c50025dd3bf154", // test
];

export function planProductUpdates(
  products: ReadonlyArray<{
    $id: string;
    sales_type?: string | null;
    status: string;
  }>
): {
  archive: string[];
  assign: Array<{ from: string | null; id: string; to: string }>;
  unmapped: string[];
} {
  const targetById = new Map<string, string>();
  for (const [salesType, ids] of Object.entries(PRODUCT_SALES_TYPES)) {
    for (const id of ids) {
      targetById.set(id, salesType);
    }
  }
  const archiveIds = new Set(PRODUCTS_TO_ARCHIVE);

  const plan = {
    archive: [] as string[],
    assign: [] as Array<{ from: string | null; id: string; to: string }>,
    unmapped: [] as string[],
  };

  for (const product of products) {
    if (archiveIds.has(product.$id)) {
      if (product.status !== "archived") {
        plan.archive.push(product.$id);
      }
      continue;
    }
    const target = targetById.get(product.$id);
    if (!target) {
      plan.unmapped.push(product.$id);
      continue;
    }
    if (product.sales_type !== target) {
      plan.assign.push({
        from: product.sales_type ?? null,
        id: product.$id,
        to: target,
      });
    }
  }
  return plan;
}
