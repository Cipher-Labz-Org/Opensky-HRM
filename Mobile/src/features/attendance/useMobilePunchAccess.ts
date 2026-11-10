import { useQuery } from "@tanstack/react-query";
import { getMobilePunchAccess } from "@/api/endpoints/attendance";

export function useMobilePunchAccess() {
  return useQuery({
    queryKey: ["attendance", "mobile-punch-access"],
    queryFn: getMobilePunchAccess,
    staleTime: 30_000,
  });
}
