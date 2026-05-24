import { prisma } from "@/lib/prisma";
import { Inventory, Prisma } from "@prisma/client";

// Raw query result shape from SELECT FOR UPDATE
interface InventoryRow {
  id: string;
  productid: string;
  warehouseid: string;
  totalquantity: number;
  reservedquantity: number;
}

/**
 * Acquires a row-level exclusive lock on the inventory row for the given
 * product+warehouse pair WITHIN an existing transaction.
 *
 * WHY FOR UPDATE:
 * Without this lock, two concurrent transactions can both read available=1,
 * both decide to reserve, and both succeed — causing overselling.
 * FOR UPDATE makes the second transaction wait until the first commits,
 * then re-reads the now-updated row.
 *
 * MUST be called inside a Prisma interactive transaction (tx parameter).
 * Calling outside a transaction would release the lock immediately.
 */
export async function lockAndGetInventory(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string
): Promise<InventoryRow | null> {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    SELECT id, "productId" as productid, "warehouseId" as warehouseid,
           "totalQuantity" as totalquantity, "reservedQuantity" as reservedquantity
    FROM "Inventory"
    WHERE "productId" = ${productId}
      AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function incrementReservedQuantity(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Inventory"
    SET "reservedQuantity" = "reservedQuantity" + ${quantity},
        "updatedAt" = NOW()
    WHERE id = ${inventoryId}
  `;
}

export async function decrementReservedQuantity(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Inventory"
    SET "reservedQuantity" = "reservedQuantity" - ${quantity},
        "updatedAt" = NOW()
    WHERE id = ${inventoryId}
  `;
}

/**
 * On CONFIRM: reserved stock becomes permanently consumed.
 * reservedQuantity goes down (reservation fulfilled), totalQuantity goes down (stock sold).
 */
export async function confirmInventoryConsumption(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Inventory"
    SET "reservedQuantity" = "reservedQuantity" - ${quantity},
        "totalQuantity"    = "totalQuantity"    - ${quantity},
        "updatedAt"        = NOW()
    WHERE id = ${inventoryId}
  `;
}

export async function getInventoryByProductAndWarehouse(
  productId: string,
  warehouseId: string
): Promise<Inventory | null> {
  return prisma.inventory.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
}
