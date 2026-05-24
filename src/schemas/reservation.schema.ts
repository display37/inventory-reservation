import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  // min(1): a reservation for 0 units is meaningless
  // max(100): prevent a single user from reserving entire stock in one shot
  quantity: z.number().int().min(1).max(100),
});

export const ReservationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
