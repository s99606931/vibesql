"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@/lib/auth/jwt";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      const json = await res.json() as { data: CurrentUser };
      return json.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useIsAdmin(): boolean {
  const { data } = useCurrentUser();
  return data?.role === "ADMIN";
}
