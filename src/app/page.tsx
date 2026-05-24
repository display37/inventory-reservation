"use client";

import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useReservation } from "@/hooks/useReservation";
import { ReservationResult } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { ReservationPanel } from "@/components/ReservationPanel";
import { ErrorAlert } from "@/components/ErrorAlert";

export default function HomePage() {
  const { products, isLoading, error: fetchError, refresh } = useProducts();
  const { reserve, confirm, release, loading, error: actionError, clearError } = useReservation();
  const [activeReservation, setActiveReservation] = useState<ReservationResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleReserve(productId: string, warehouseId: string) {
    clearError();
    setSuccessMessage(null);
    const result = await reserve(productId, warehouseId, 1);
    if (result) {
      setActiveReservation(result);
      refresh(); // immediately refresh stock display
    }
  }

  async function handleConfirm() {
    if (!activeReservation) return;
    clearError();
    const result = await confirm(activeReservation.id);
    if (result) {
      setActiveReservation(null);
      setSuccessMessage(`Order confirmed! Reservation ${result.id} is complete.`);
      refresh();
    }
  }

  async function handleCancel() {
    if (!activeReservation) return;
    clearError();
    const result = await release(activeReservation.id);
    if (result) {
      setActiveReservation(null);
      setSuccessMessage("Reservation cancelled. Stock has been released.");
      refresh();
    }
  }

  function handleExpire() {
    setActiveReservation((prev) => prev); // keep panel visible to show expired state
    refresh();
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Reservation System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stock updates every 5 seconds. Reservations expire in 10 minutes.
        </p>
      </div>

      {actionError && <ErrorAlert code={actionError.code} message={actionError.message} />}

      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {activeReservation && (
        <ReservationPanel
          reservation={activeReservation}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onExpire={handleExpire}
          loading={loading}
        />
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Products</h2>
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${products.length} products`}
          </span>
        </div>

        {fetchError && (
          <ErrorAlert code="INTERNAL_ERROR" message="Failed to load products. Retrying…" />
        )}

        <div className="space-y-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onReserve={handleReserve}
              disabled={loading || !!activeReservation}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
