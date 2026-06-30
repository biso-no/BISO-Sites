# Umami Analytics — BISO web

Product analytics is **self-hosted Umami** at `https://analytics.biso.no` (cookieless,
GDPR-friendly, no consent banner needed). The tracker `<Script>` loads in
`apps/web/src/app/layout.tsx`; pageviews (including App Router client navigations) are
tracked automatically. This doc covers the **custom events** the web app emits and the
**dashboard reports** to configure in the Umami UI.

## Emitting events (code)

Never call `window.umami` directly. Use the shared, typed helper:

```ts
import { trackEvent, identifyUser, trackPurchase } from "@repo/shared/utils/analytics";

trackEvent("add_to_cart", { productId, name, quantity }); // names are a strict union
trackPurchase({ revenue: order.total, orderId, type: "membership" }); // currency forced to NOK
identifyUser(accountId, { campus, role, isMember }); // non-PII only — never name/email
```

The helper no-ops on the server, before the tracker loads, and in non-production builds
(set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` to test events locally). Event data values must be
primitives (string / number / boolean). Adding a new event = add its name to the
`AnalyticsEventName` union in `packages/shared/utils/analytics.ts` (else `check-types` fails).

## Event taxonomy

### Conversions
| Event | Data | Fired from |
|---|---|---|
| `purchase` *(revenue)* | `revenue, currency:"NOK", orderId, type, campus` | `components/shop/purchase-tracker.tsx` on the order-success page |
| `add_to_cart` / `remove_from_cart` | `productId, name, category?, quantity` | `lib/contexts/cart-context.tsx` |
| `checkout_start` | `provider, itemCount, value` | `shop/checkout/checkout-page-client.tsx` |
| `checkout_provider_selected` | `provider` | checkout provider radio |
| `membership_cta_click` | `source, campus?, duration?` | nav, home join-us, membership page |
| `job_application_step` / `job_application_submit` | `jobId, step` / `jobId` | `jobs/job-application-form.tsx` |
| `varsling_submit` | `submissionType` *(no PII / campus)* | `safety/varsling-form.tsx` |
| `expense_submit` | `campus` | `expense-v3/expense-split-view.tsx` |
| `event_register` / `event_ticket_click` | `eventId` | `events/event-actions.tsx` |

### Engagement
`campus_switch` · `language_switch` · `nav_menu_open` · `search` · `outbound_click` ·
`document_download` · `share` — plus the guided-tour events (`tour_*`) emitted from admin.

### Member identity
Logged-in members are identified with their **Appwrite account `$id`** (`identifyUser`)
plus non-PII attributes (`campus`, `role`, `isMember`). Anonymous visitors are never
identified (`getLoggedInUser()` returns null). Names are resolved **admin-side** from the
id in the admin Analytics dashboard — they are never sent to Umami.

## Dashboard configuration (Umami UI — manual, one-time)

These reports are built from the events above; configure them under the web website
(`ada2c233-…`) in the Umami dashboard.

- **Revenue report** — works automatically once `purchase` events flow (revenue + NOK).
  Segment by the `type` property to split membership vs merch.
- **Funnels** (Reports → Funnel; set a sensible window, e.g. 30 min):
  - *Membership*: page `/membership` → event `membership_cta_click` → `checkout_start` → `purchase`
  - *Job application*: page `/jobs/*` → `job_application_step` → `job_application_submit`
  - *Shop*: page `/shop/*` → `add_to_cart` → `checkout_start` → `purchase`
- **Goals** (Reports → Goal): `purchase`, `job_application_submit`, `varsling_submit`,
  `membership_cta_click`; set targets per term.
- **Retention** & **Journey**: enable as-is to see return visits and top paths.
- **UTM / campaigns**: add `utm_source`/`utm_medium`/`utm_campaign` to marketing & social
  links so the campaign breakdown populates.
