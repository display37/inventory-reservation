import { NextRequest } from "next/server";
import { confirmReservation } from "@/services/reservation.service";
import { ok, err } from "@/lib/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await confirmReservation(id);
  if ("error" in result) return err(result.error);
  return ok(result.data);
}
