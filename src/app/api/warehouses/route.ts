import { getAllWarehouses } from "@/repositories/product.repository";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  try {
    const warehouses = await getAllWarehouses();
    return ok(warehouses);
  } catch (e) {
    console.error("[GET /api/warehouses]", e);
    return err({ code: "INTERNAL_ERROR", message: "Failed to fetch warehouses." });
  }
}
