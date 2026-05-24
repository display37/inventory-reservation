"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ProductWithAvailability } from "@/types";

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR<ProductWithAvailability[]>(
    "/api/products",
    fetcher,
    { refreshInterval: 5000 } // poll every 5s — shows stock changes in near real-time
  );

  return { products: data ?? [], error, isLoading, refresh: mutate };
}
