import { NextRequest } from "next/server";
import { CreateReservationSchema } from "@/schemas/reservation.schema";
import { reserveStock } from "@/services/reservation.service";
import { ok, err } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err({ code: "VALIDATION_ERROR", message: "Invalid JSON body." });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return err({ code: "VALIDATION_ERROR", message: parsed.error.issues[0].message });
  }

  const result = await reserveStock(parsed.data);

  if ("error" in result) return err(result.error);
  return ok(result.data, 201);
}
