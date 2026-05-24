"use client";

import { useState } from "react";
import { poster, ApiError } from "@/lib/fetcher";
import { ReservationResult } from "@/types";

export function useReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function reserve(productId: string, warehouseId: string, quantity: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await poster<ReservationResult>("/api/reservations", {
        productId,
        warehouseId,
        quantity,
      });
      return data;
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "UNKNOWN", message: "Unexpected error" };
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function confirm(reservationId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await poster<ReservationResult>(`/api/reservations/${reservationId}/confirm`);
      return data;
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "UNKNOWN", message: "Unexpected error" };
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function release(reservationId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await poster<ReservationResult>(`/api/reservations/${reservationId}/release`);
      return data;
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "UNKNOWN", message: "Unexpected error" };
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { reserve, confirm, release, loading, error, clearError: () => setError(null) };
}
