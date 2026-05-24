import { getAllProducts } from "@/repositories/product.repository";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  try {
    const products = await getAllProducts();
    return ok(products);
  } catch (e) {
    console.error("[GET /api/products]", e);
    return err({ code: "INTERNAL_ERROR", message: "Failed to fetch products." });
  }
}
