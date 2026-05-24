import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Warehouses
  const [delhi, mumbai] = await Promise.all([
    prisma.warehouse.upsert({
      where: { id: "wh_delhi_001" },
      update: {},
      create: { id: "wh_delhi_001", name: "Delhi FC", location: "New Delhi, IN" },
    }),
    prisma.warehouse.upsert({
      where: { id: "wh_mumbai_001" },
      update: {},
      create: { id: "wh_mumbai_001", name: "Mumbai FC", location: "Mumbai, IN" },
    }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "IPHONE-15-PRO-256" },
      update: {},
      create: { id: "prod_iphone_001", name: "iPhone 15 Pro 256GB", sku: "IPHONE-15-PRO-256" },
    }),
    prisma.product.upsert({
      where: { sku: "SAMSUNG-S24-128" },
      update: {},
      create: { id: "prod_samsung_001", name: "Samsung Galaxy S24 128GB", sku: "SAMSUNG-S24-128" },
    }),
    // Low-stock product — perfect for demoing the 409 race condition
    prisma.product.upsert({
      where: { sku: "PIXEL-8-PRO-LAST" },
      update: {},
      create: { id: "prod_pixel_001", name: "Google Pixel 8 Pro (Last Unit!)", sku: "PIXEL-8-PRO-LAST" },
    }),
  ]);

  // Inventory
  await Promise.all([
    prisma.inventory.upsert({
      where: { productId_warehouseId: { productId: products[0].id, warehouseId: delhi.id } },
      update: {},
      create: { productId: products[0].id, warehouseId: delhi.id, totalQuantity: 50, reservedQuantity: 0 },
    }),
    prisma.inventory.upsert({
      where: { productId_warehouseId: { productId: products[0].id, warehouseId: mumbai.id } },
      update: {},
      create: { productId: products[0].id, warehouseId: mumbai.id, totalQuantity: 30, reservedQuantity: 0 },
    }),
    prisma.inventory.upsert({
      where: { productId_warehouseId: { productId: products[1].id, warehouseId: delhi.id } },
      update: {},
      create: { productId: products[1].id, warehouseId: delhi.id, totalQuantity: 20, reservedQuantity: 0 },
    }),
    // Only 1 unit — the race condition demo product
    prisma.inventory.upsert({
      where: { productId_warehouseId: { productId: products[2].id, warehouseId: mumbai.id } },
      update: {},
      create: { productId: products[2].id, warehouseId: mumbai.id, totalQuantity: 1, reservedQuantity: 0 },
    }),
  ]);

  console.log("✅ Seed complete");
  console.log(`   Warehouses: ${delhi.name}, ${mumbai.name}`);
  console.log(`   Products: ${products.map((p) => p.sku).join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
