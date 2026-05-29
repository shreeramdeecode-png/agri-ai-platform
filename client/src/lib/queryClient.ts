import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, errorFromResponse } from "@/lib/api-errors";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, {
      message: "Network error — check your connection and that the server is running.",
      code: "EXTERNAL_API_ERROR",
      retryable: true,
    });
  }

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(res.status, {
      message: "Server returned an invalid response. Restart the dev server and try again.",
      code: "INTERNAL_ERROR",
      retryable: true,
    });
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let res: Response;
    try {
      res = await fetch(queryKey.join("/") as string, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
    } catch {
      throw new ApiError(0, {
        message: "Network error — could not load data.",
        code: "EXTERNAL_API_ERROR",
        retryable: true,
      });
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      throw await errorFromResponse(res);
    }

    const text = await res.text();
    if (!text.trim()) return null as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, {
        message: "Invalid response from server.",
        code: "INTERNAL_ERROR",
        retryable: true,
      });
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
