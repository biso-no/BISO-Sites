/** The parts of an api error body the web reads. */
export interface ApiErrorBody {
  error?: string;
  /** The saved draft, on a submit turned away for a missing occasion. */
  expenseId?: string;
  field?: string;
}

/** Thrown by the api client on a non-2xx answer; keeps the status and parsed body. */
export class ApiError extends Error {
  readonly body: ApiErrorBody | null;
  readonly status: number;

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
