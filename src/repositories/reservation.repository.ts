import { prisma } from "@/lib/prisma";
import { Prisma, Reservation, ReservationStatus } from "@prisma/client";

export async function createReservation(
  tx: Prisma.TransactionClient,
  data: {
    productId: string;
    warehouseId: string;
    quantity: number;
    expiresAt: Date;
  }
): Promise<Reservation> {
  return tx.reservation.create({ data });
}

export async function findReservationById(id: string): Promise<Reservation | null> {
  return prisma.reservation.findUnique({ where: { id } });
}

/**
 * Atomically transition a reservation status.
 * The WHERE clause includes the expected current status — if the reservation
 * was already finalized by a concurrent request, this update matches 0 rows
 * and we can detect the conflict.
 */
export async function updateReservationStatus(
  tx: Prisma.TransactionClient,
  id: string,
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus,
  timestampField: "confirmedAt" | "releasedAt"
): Promise<Reservation | null> {
  const results = await tx.$queryRaw<Reservation[]>`
    UPDATE "Reservation"
    SET status = ${toStatus}::"ReservationStatus",
        ${Prisma.raw(`"${timestampField}"`)} = NOW()
    WHERE id = ${id}
      AND status = ${fromStatus}::"ReservationStatus"
    RETURNING *
  `;
  return results[0] ?? null;
}

/**
 * Finds all PENDING reservations past their expiry time.
 * Used by the cleanup cron job.
 * Limit 100 per run to avoid long-running transactions.
 */
export async function findExpiredPendingReservations(): Promise<Reservation[]> {
  return prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    take: 100,
    orderBy: { expiresAt: "asc" },
  });
}
