"use client";

import { ProductWithAvailability } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  product: ProductWithAvailability;
  onReserve: (productId: string, warehouseId: string) => void;
  disabled?: boolean;
}

export function ProductCard({ product, onReserve, disabled }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{product.name}</CardTitle>
        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {product.inventories.map((inv) => {
          const available = inv.availableQuantity;
          const isLow = available > 0 && available <= 3;
          const isOut = available === 0;

          return (
            <div key={inv.warehouseId} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
              <div>
                <p className="font-medium">{inv.warehouseName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={isOut ? "destructive" : isLow ? "outline" : "secondary"}>
                    {isOut ? "Out of stock" : isLow ? `Only ${available} left!` : `${available} available`}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                disabled={disabled || isOut}
                onClick={() => onReserve(product.id, inv.warehouseId)}
              >
                Reserve
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
