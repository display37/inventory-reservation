"use client";

import { ReservationResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "./CountdownTimer";

interface Props {
  reservation: ReservationResult;
  onConfirm: () => void;
  onCancel: () => void;
  onExpire: () => void;
  loading: boolean;
}

export function ReservationPanel({ reservation, onConfirm, onCancel, onExpire, loading }: Props) {
  const isExpired = new Date(reservation.expiresAt) < new Date();

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-800">Reservation Active</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reservation ID</span>
          <span className="font-mono text-xs">{reservation.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-semibold">{reservation.quantity}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Expires in</span>
          {isExpired ? (
            <span className="text-red-500 font-semibold">Expired</span>
          ) : (
            <CountdownTimer expiresAt={reservation.expiresAt} onExpire={onExpire} />
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1"
            onClick={onConfirm}
            disabled={loading || isExpired}
          >
            {loading ? "Processing…" : "Confirm Purchase"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
