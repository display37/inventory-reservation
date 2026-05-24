export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error?.code ?? "UNKNOWN", json.error?.message ?? "Request failed", res.status);
  }
  return json.data as T;
}

export async function poster<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error?.code ?? "UNKNOWN", json.error?.message ?? "Request failed", res.status);
  }
  return json.data as T;
}
