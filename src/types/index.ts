import { ReservationStatus } from "@prisma/client";
import { CreateReservationInput } from "@/schemas/reservation.schema";

export type { ReservationStatus, CreateReservationInput };

export interface ProductWithAvailability {
  id: string;
  name: string;
  sku: string;
  inventories: {
    warehouseId: string;
    warehouseName: string;
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number; // computed: totalQuantity - reservedQuantity
  }[];
}

export interface ReservationResult {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

// Typed error codes for API responses — lets the frontend branch on error type
export type AppErrorCode =
  | "INSUFFICIENT_STOCK"   // 409
  | "RESERVATION_EXPIRED"  // 410
  | "RESERVATION_NOT_FOUND" // 404
  | "ALREADY_FINALIZED"    // 409 — confirm/release on non-PENDING reservation
  | "VALIDATION_ERROR"     // 400
  | "INTERNAL_ERROR";      // 500

export interface AppError {
  code: AppErrorCode;
  message: string;
}
