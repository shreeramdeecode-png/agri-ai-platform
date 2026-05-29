export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DOMAIN_NOT_SUPPORTED"
  | "TIMEOUT"
  | "EXTERNAL_API_ERROR"
  | "AI_SERVICE_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  message: string;
  code?: ErrorCode;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = body.code ?? defaultCode(status);
    this.retryable = body.retryable ?? (status === 504 || status >= 500);
  }
}

function defaultCode(status: number): ErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 504) return "TIMEOUT";
  if (status === 400) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

function tryParseJson(text: string): ApiErrorBody | null {
  try {
    const parsed = JSON.parse(text) as ApiErrorBody;
    if (parsed && typeof parsed.message === "string") return parsed;
  } catch {
    /* not JSON */
  }
  return null;
}

/** Parse failed fetch Response into a user-friendly ApiError. */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  const text = (await res.text()) || res.statusText;
  const parsed = tryParseJson(text);

  if (parsed) {
    return new ApiError(res.status, parsed);
  }

  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    return new ApiError(
      res.status || 502,
      {
        message:
          "Server returned a web page instead of data. Restart the dev server and try again.",
        code: "INTERNAL_ERROR",
        retryable: true,
      },
    );
  }

  const legacy = text.match(/^\d{3}:\s*(.+)$/s);
  if (legacy) {
    const inner = tryParseJson(legacy[1].trim());
    if (inner) return new ApiError(res.status, inner);
  }

  return new ApiError(res.status, {
    message: text.slice(0, 280) || res.statusText || "Request failed",
    code: defaultCode(res.status),
    retryable: res.status >= 500,
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    const legacy = error.message.match(/^\d{3}:\s*(\{[\s\S]*\})/);
    if (legacy) {
      const parsed = tryParseJson(legacy[1]);
      if (parsed?.message) return parsed.message;
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError && error.retryable;
}

export function errorTitle(error: unknown): string {
  if (!(error instanceof ApiError)) return "Error";
  switch (error.code) {
    case "TIMEOUT":
      return "Timed out";
    case "DOMAIN_NOT_SUPPORTED":
      return "Not supported yet";
    case "UNAUTHORIZED":
      return "Sign in required";
    case "VALIDATION_ERROR":
      return "Invalid input";
    case "EXTERNAL_API_ERROR":
    case "AI_SERVICE_ERROR":
      return "Service unavailable";
    default:
      return "Error";
  }
}
