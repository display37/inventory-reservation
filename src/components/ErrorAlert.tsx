interface Props {
  code: string;
  message: string;
}

const CODE_LABELS: Record<string, string> = {
  INSUFFICIENT_STOCK: "409 — Out of Stock",
  RESERVATION_EXPIRED: "410 — Reservation Expired",
  ALREADY_FINALIZED: "409 — Already Finalized",
  RESERVATION_NOT_FOUND: "404 — Not Found",
  VALIDATION_ERROR: "400 — Invalid Request",
  INTERNAL_ERROR: "500 — Server Error",
};

export function ErrorAlert({ code, message }: Props) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
      <p className="font-semibold text-red-700">{CODE_LABELS[code] ?? code}</p>
      <p className="text-red-600 mt-0.5">{message}</p>
    </div>
  );
}
