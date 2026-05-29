import { ApiError, errorFromResponse } from "@/lib/api-errors";

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Authenticated fetch; throws ApiError when response is not OK. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: authHeaders(init.headers),
      credentials: "include",
    });
    if (!res.ok) throw await errorFromResponse(res);
    return res;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, {
      message: "Network error — check your connection and that the server is running.",
      code: "EXTERNAL_API_ERROR",
      retryable: true,
    });
  }
}

export async function authFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, init);
  const text = await res.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}
