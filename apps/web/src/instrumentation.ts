import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logServerRequestError({
    app: "web",
    context,
    error,
    request,
  });
};
