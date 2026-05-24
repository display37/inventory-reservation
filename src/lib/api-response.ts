import { NextResponse } from "next/server";
import { AppError } from "@/types";

const STATUS_MAP: Record<string, number> = {
  INSUFFICIENT_STOCK: 409,
  RESERVATION_EXPIRED: 410,
  RESERVATION_NOT_FOUND: 404,
  ALREADY_FINALIZED: 409,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(error: AppError) {
  return NextResponse.json({ error }, { status: STATUS_MAP[error.code] ?? 500 });
}
