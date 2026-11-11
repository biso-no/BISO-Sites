/** Thrown by the api client on a non-2xx answer; keeps the status and parsed body. */
export class ApiError extends Error {
  readonly body: { error?: string; field?: string } | null;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    body: { error?: string; field?: string } | null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
