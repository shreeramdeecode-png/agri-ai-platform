import { TimeoutError } from "./errors.js";

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new TimeoutError(label));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  }) as Promise<T>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1000,
  label = "operation"
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isTimeout = err instanceof TimeoutError;
      const isLastAttempt = attempt === retries;

      if (isLastAttempt || isTimeout) {
        throw err;
      }

      console.warn(`[retry] ${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delayMs}ms...`);
      await delay(delayMs * (attempt + 1));
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const responseCache = new Map<string, { value: any; expiresAt: number }>();

export function cacheKey(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join("::");
}

export function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
  if (responseCache.size > 500) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
