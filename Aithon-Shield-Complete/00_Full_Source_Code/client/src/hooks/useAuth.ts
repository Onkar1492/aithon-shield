import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";

export function useAuth() {
  const { data, isLoading, error } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    retry: false,
    // Don't throw errors to avoid error boundaries
    // We'll handle auth state in components
  });

  const isAuthenticated = !!data?.user && !error;

  return {
    user: data?.user,
    isLoading,
    isAuthenticated,
  };
}
