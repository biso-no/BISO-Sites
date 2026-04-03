/**
 * Finago REST API — Typed Client
 *
 * Creates a type-safe openapi-fetch client bound to the generated
 * schema from the Finago OpenAPI spec. All request/response types
 * are inferred automatically.
 *
 * Authorization is injected via middleware so it is set directly on
 * the native Request object (`request.headers.set`), which is more
 * reliable than passing it through `params.header` serialization.
 */

import createClient from "openapi-fetch";
import { getAccessToken } from "./auth";
import type { paths } from "./schema";

export const finago = createClient<paths>({
  baseUrl: "https://rest.api.24sevenoffice.com/v1",
});

finago.use({
  async onRequest({ request }) {
    const token = await getAccessToken();
    request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
});
