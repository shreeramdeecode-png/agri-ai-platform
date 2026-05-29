import type { Response } from "express";
import { ZodError } from "zod";

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
  code: ErrorCode;
  retryable: boolean;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCode = "INTERNAL_ERROR",
    retryable = false,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
  }

  toJSON(): ApiErrorBody {
    return {
      message: this.message,
      code: this.code,
      retryable: this.retryable,
    };
  }
}

function codeForStatus(status: number): ErrorCode {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 504) return "TIMEOUT";
  return "INTERNAL_ERROR";
}

export function fromUnknown(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    const detail = error.errors.map((e) => e.message).join("; ");
    return new AppError(400, detail || "Invalid request data", "VALIDATION_ERROR");
  }

  const err = error as { code?: string; message?: string; status?: number; statusCode?: number };

  if (err?.code === "LIMIT_FILE_SIZE") {
    return new AppError(400, "File exceeds the 10MB limit.", "VALIDATION_ERROR");
  }
  if (err?.code === "LIMIT_UNEXPECTED_FILE") {
    return new AppError(400, "Unexpected file upload field.", "VALIDATION_ERROR");
  }

  const rawMessage =
    typeof err?.message === "string" ? err.message : "An unexpected error occurred";

  if (/timed out/i.test(rawMessage)) {
    return new AppError(
      504,
      rawMessage.replace(/\.\s*$/, "") + ". Please try again.",
      "TIMEOUT",
      true,
    );
  }

  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(rawMessage)) {
    return new AppError(
      503,
      "Could not reach an external service. Check your connection and try again.",
      "EXTERNAL_API_ERROR",
      true,
    );
  }

  if (/API key|GOOGLE_API_KEY|401|403/i.test(rawMessage) && /gemini|google/i.test(rawMessage)) {
    return new AppError(
      503,
      "AI service is not configured or rejected the request. Check GOOGLE_API_KEY in .env.",
      "AI_SERVICE_ERROR",
      false,
    );
  }

  if (/Failed to process|Image analysis|Document Q&A|Response generation/i.test(rawMessage)) {
    return new AppError(500, rawMessage, "AI_SERVICE_ERROR", true);
  }

  const status = err?.status ?? err?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 600) {
    return new AppError(status, rawMessage, codeForStatus(status), status >= 500);
  }

  return new AppError(500, rawMessage, "INTERNAL_ERROR", true);
}

export function logRouteError(label: string, error: unknown): void {
  const normalized = fromUnknown(error);
  console.error(`[${label}] ${normalized.code}: ${normalized.message}`);
  if (process.env.NODE_ENV !== "production" && !(error instanceof AppError)) {
    console.error(error);
  }
}

export function sendError(res: Response, error: unknown): void {
  if (res.headersSent) return;
  const appError = fromUnknown(error);
  res.status(appError.statusCode).json(appError.toJSON());
}
