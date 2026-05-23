export type ErrorCode =
  | "AI_PROVIDER_FAILED"
  | "GEMINI_FAILED"
  | "OPENAI_FAILED"
  | "TIMEOUT"
  | "HDX_API_FAILED"
  | "PDF_PARSE_FAILED"
  | "EMBEDDING_FAILED"
  | "UPLOAD_FAILED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DB_ERROR"
  | "DOMAIN_NOT_SUPPORTED";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: ErrorCode, statusCode = 500, isOperational = true) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TimeoutError extends AppError {
  constructor(label: string) {
    super(`Request timed out: ${label}`, "TIMEOUT", 504);
  }
}

export class AIProviderError extends AppError {
  constructor(provider: string, originalMessage: string) {
    super(
      `AI provider "${provider}" failed: ${originalMessage}`,
      provider === "gemini" ? "GEMINI_FAILED" : "OPENAI_FAILED",
      503
    );
  }
}

export class HDXApiError extends AppError {
  constructor(message: string) {
    super(`HDX HAPI error: ${message}`, "HDX_API_FAILED", 503);
  }
}

export function toHttpError(err: unknown): { code: string; message: string; statusCode: number } {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, statusCode: err.statusCode };
  }
  if (err instanceof Error) {
    return { code: "INTERNAL_ERROR", message: err.message, statusCode: 500 };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred", statusCode: 500 };
}
