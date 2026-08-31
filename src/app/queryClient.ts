import { QueryClient } from "@tanstack/react-query";

export const mobileQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error) => {
        const status = Number((error as { status?: unknown })?.status || 0);
        if ([400, 401, 403, 404].includes(status)) return false;
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
      networkMode: "online",
    },
  },
});
