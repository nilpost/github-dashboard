import { QueryClient } from "@tanstack/react-query";
import { csrfHeaders } from "./csrf";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<any> {
  const method = (options?.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(isMutation ? await csrfHeaders() : {}),
      ...options?.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
