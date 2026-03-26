import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { rethrowIfUnreachableFetchError } from "./apiFetch";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let parsedMessage: string | null = null;
    try {
      const parsed = JSON.parse(text) as { message?: string; hint?: string };
      if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
        parsedMessage = parsed.message.trim();
        if (typeof parsed?.hint === "string" && parsed.hint.trim().length > 0) {
          parsedMessage = `${parsedMessage}. ${parsed.hint.trim()}`;
        }
      }
    } catch {
      // not JSON
    }
    if (parsedMessage) {
      throw new Error(parsedMessage);
    }
    throw new Error(text.length > 300 ? `${res.status}: ${text.slice(0, 280)}…` : `${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (e) {
    rethrowIfUnreachableFetchError(e);
  }

  await throwIfResNotOk(res);
  return res;
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
        credentials: "include",
      });
    } catch (e) {
      rethrowIfUnreachableFetchError(e);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
