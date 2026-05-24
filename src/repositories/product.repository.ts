import { prisma } from "@/lib/prisma";
import { ProductWithAvailability } from "@/types";

export async function getAllProducts(): Promise<ProductWithAvailability[]> {
  const products = await prisma.product.findMany({
    include: {
      inventories: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    inventories: p.inventories.map((inv) => ({
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      totalQuantity: inv.totalQuantity,
      reservedQuantity: inv.reservedQuantity,
      // Computed here — never stored, always consistent
      availableQuantity: inv.totalQuantity - inv.reservedQuantity,
    })),
  }));
}

export async function getAllWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}
