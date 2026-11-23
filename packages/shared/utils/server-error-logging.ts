import { redactHeaders, scrubUrl } from "@repo/observability/scrub";

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
  // Credentials and IP addresses redacted, query strings dropped: this line
  // reaches stdout and Sentry's logs.
  console.error("[request-error]", {
    app,
    context: context ?? {},
    error: serializeError(error),
    request: {
      headers: redactHeaders(request?.headers),
      method: request?.method,
      path: request?.path === undefined ? undefined : scrubUrl(request.path),
    },
    timestamp: new Date().toISOString(),
  });
};
