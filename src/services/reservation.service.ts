import { prisma } from "@/lib/prisma";
import { CreateReservationInput, ReservationResult, AppError } from "@/types";
import {
  lockAndGetInventory,
  incrementReservedQuantity,
  decrementReservedQuantity,
  confirmInventoryConsumption,
  getInventoryByProductAndWarehouse,
} from "@/repositories/inventory.repository";
import {
  createReservation,
  findReservationById,
  updateReservationStatus,
  findExpiredPendingReservations,
} from "@/repositories/reservation.repository";

const EXPIRY_MINUTES = Number(process.env.RESERVATION_EXPIRY_MINUTES ?? 10);

function toReservationResult(r: {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: import("@prisma/client").ReservationStatus;
  expiresAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
}): ReservationResult {
  return {
    ...r,
    expiresAt: r.expiresAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * RESERVE — the critical path.
 *
 * Transaction boundary: the entire function body runs inside one Postgres transaction.
 * Lock order: always lock Inventory before writing Reservation.
 * This consistent lock ordering prevents deadlocks when multiple products
 * are reserved simultaneously (not in scope here, but good practice).
 *
 * Concurrency guarantee:
 *   SELECT FOR UPDATE serializes concurrent reservations for the same inventory row.
 *   Only one transaction holds the lock at a time — the second waits, then re-reads
 *   the updated reservedQuantity and correctly sees insufficient stock.
 */
export async function reserveStock(
  input: CreateReservationInput
): Promise<{ data: ReservationResult } | { error: AppError }> {
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the inventory row exclusively.
      // Any concurrent reservation for the same product+warehouse will block here.
      const inventory = await lockAndGetInventory(tx, input.productId, input.warehouseId);

      if (!inventory) {
        throw { code: "INSUFFICIENT_STOCK", message: "No inventory record found for this product/warehouse combination." };
      }

      // Step 2: Compute available stock INSIDE the transaction, AFTER acquiring the lock.
      // Computing this outside the transaction (e.g., in a pre-check) would be a TOCTOU bug.
      const available = inventory.totalquantity - inventory.reservedquantity;

      if (available < input.quantity) {
        throw {
          code: "INSUFFICIENT_STOCK",
          message: `Only ${available} unit(s) available, requested ${input.quantity}.`,
        };
      }

      // Step 3: Increment reservedQuantity atomically.
      await incrementReservedQuantity(tx, inventory.id, input.quantity);

      // Step 4: Create the reservation record.
      // If this INSERT fails (e.g., FK violation), Postgres rolls back Step 3 too.
      const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
      return createReservation(tx, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        expiresAt,
      });
    });

    return { data: toReservationResult(reservation) };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "INSUFFICIENT_STOCK") {
      return { error: { code: "INSUFFICIENT_STOCK", message: e.message ?? "Insufficient stock." } };
    }
    console.error("[reserveStock]", err);
    return { error: { code: "INTERNAL_ERROR", message: "Unexpected error during reservation." } };
  }
}

/**
 * CONFIRM — payment succeeded, make the stock deduction permanent.
 *
 * Transaction boundary:
 *   1. Atomically transition PENDING → CONFIRMED (WHERE status='PENDING' guard)
 *   2. Decrement both reservedQuantity AND totalQuantity
 *
 * The WHERE status='PENDING' in updateReservationStatus means:
 *   - If expiry job already released this reservation, the UPDATE matches 0 rows → 409
 *   - If user double-clicks confirm, second request gets 0 rows → 409
 */
export async function confirmReservation(
  id: string
): Promise<{ data: ReservationResult } | { error: AppError }> {
  const existing = await findReservationById(id);

  if (!existing) {
    return { error: { code: "RESERVATION_NOT_FOUND", message: "Reservation not found." } };
  }

  if (existing.status !== "PENDING") {
    return { error: { code: "ALREADY_FINALIZED", message: `Reservation is already ${existing.status}.` } };
  }

  // Check expiry before attempting confirm — return 410 not 409
  if (existing.expiresAt < new Date()) {
    return { error: { code: "RESERVATION_EXPIRED", message: "Reservation has expired." } };
  }

  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      const updated = await updateReservationStatus(tx, id, "PENDING", "CONFIRMED", "confirmedAt");

      // If null: concurrent request (expiry job or double-click) already changed status
      if (!updated) {
        throw { code: "ALREADY_FINALIZED", message: "Reservation was finalized by a concurrent request." };
      }

      const inventory = await getInventoryByProductAndWarehouse(
        existing.productId,
        existing.warehouseId
      );
      if (inventory) {
        await confirmInventoryConsumption(tx, inventory.id, existing.quantity);
      }

      return updated;
    });

    return { data: toReservationResult(confirmed) };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "ALREADY_FINALIZED") {
      return { error: { code: "ALREADY_FINALIZED", message: e.message ?? "Already finalized." } };
    }
    console.error("[confirmReservation]", err);
    return { error: { code: "INTERNAL_ERROR", message: "Unexpected error during confirmation." } };
  }
}

/**
 * RELEASE — payment failed or user cancelled.
 *
 * Same atomic status transition pattern as confirm.
 * Decrements only reservedQuantity (totalQuantity unchanged — stock goes back to available).
 */
export async function releaseReservation(
  id: string
): Promise<{ data: ReservationResult } | { error: AppError }> {
  const existing = await findReservationById(id);

  if (!existing) {
    return { error: { code: "RESERVATION_NOT_FOUND", message: "Reservation not found." } };
  }

  if (existing.status !== "PENDING") {
    return { error: { code: "ALREADY_FINALIZED", message: `Reservation is already ${existing.status}.` } };
  }

  try {
    const released = await prisma.$transaction(async (tx) => {
      const updated = await updateReservationStatus(tx, id, "PENDING", "RELEASED", "releasedAt");

      if (!updated) {
        throw { code: "ALREADY_FINALIZED", message: "Reservation was finalized by a concurrent request." };
      }

      const inventory = await getInventoryByProductAndWarehouse(
        existing.productId,
        existing.warehouseId
      );
      if (inventory) {
        await decrementReservedQuantity(tx, inventory.id, existing.quantity);
      }

      return updated;
    });

    return { data: toReservationResult(released) };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "ALREADY_FINALIZED") {
      return { error: { code: "ALREADY_FINALIZED", message: e.message ?? "Already finalized." } };
    }
    console.error("[releaseReservation]", err);
    return { error: { code: "INTERNAL_ERROR", message: "Unexpected error during release." } };
  }
}

/**
 * EXPIRY CLEANUP — called by cron job.
 *
 * Processes expired reservations in batches of 100.
 * Each release is its own transaction — we don't want one bad row to
 * block releasing 99 valid expired reservations.
 *
 * Returns count of successfully released reservations.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await findExpiredPendingReservations();
  let released = 0;

  for (const reservation of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await updateReservationStatus(tx, reservation.id, "PENDING", "RELEASED", "releasedAt");
        if (!updated) return; // already handled by concurrent request

        const inventory = await getInventoryByProductAndWarehouse(
          reservation.productId,
          reservation.warehouseId
        );
        if (inventory) {
          await decrementReservedQuantity(tx, inventory.id, reservation.quantity);
        }
      });
      released++;
    } catch (err) {
      console.error(`[releaseExpiredReservations] Failed for reservation ${reservation.id}:`, err);
    }
  }

  return released;
}
