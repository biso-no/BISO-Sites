import { SENSITIVE_HEADERS } from "@repo/observability/scrub";

type HeaderValue = string | string[] | undefined;

interface ServerRequest {
  headers?: Record<string, HeaderValue>;
  method?: string;
  path?: string;
}

type ServerErrorContext = Record<string, unknown>;

interface LogServerRequestErrorInput {
  app: string;
  context?: ServerErrorContext;
  error: unknown;
  request?: ServerRequest;
}

const redactHeaders = (
  headers: Record<string, HeaderValue> | undefined
): Record<string, HeaderValue> => {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[redacted]" : value,
    ])
  );
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      digest: "digest" in error ? error.digest : undefined,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    digest: undefined,
    message: String(error),
    name: "UnknownError",
    stack: undefined,
  };
};

export const logServerRequestError = ({
  app,
  context,
  error,
  request,
}: LogServerRequestErrorInput) => {
  console.error("[request-error]", {
    app,
    context: context ?? {},
    error: serializeError(error),
    request: {
      headers: redactHeaders(request?.headers),
      method: request?.method,
      path: request?.path,
    },
    timestamp: new Date().toISOString(),
  });
};
