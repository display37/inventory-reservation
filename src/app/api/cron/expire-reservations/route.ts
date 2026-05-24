import { NextRequest } from "next/server";
import { releaseExpiredReservations } from "@/services/reservation.service";

/**
 * Protected by CRON_SECRET header to prevent unauthorized triggering.
 * Vercel Cron sends Authorization: Bearer <secret>.
 * Schedule: every minute (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const released = await releaseExpiredReservations();
  return Response.json({ released, timestamp: new Date().toISOString() });
}
