export type GatewayRecord = Record<string, unknown> & {
  ItemId?: string;
  itemId?: string;
  id?: string;
  CreatedBy?: string;
  createdBy?: string;
  CreatedDate?: string;
  createdDate?: string;
};

export function assertNoGraphqlErrors(response: unknown): void {
  const errors = (response as { errors?: { message?: string }[] })?.errors;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message || "GraphQL error").join("; "));
  }
}

export function recordId(record: GatewayRecord): string {
  const id = record.ItemId ?? record.itemId ?? record.id;
  if (!id) throw new Error("Record id is missing.");
  return String(id);
}

export function optionalRecordId(record: GatewayRecord): string | undefined {
  const id = record.ItemId ?? record.itemId ?? record.id;
  return id ? String(id) : undefined;
}

export function fieldValue(record: GatewayRecord, pascal: string, camel: string, fallback: string): string;
export function fieldValue<T>(record: GatewayRecord, pascal: string, camel: string, fallback: T): T;
export function fieldValue<T>(record: GatewayRecord, pascal: string, camel: string, fallback: T): T {
  const value = record[pascal] ?? record[camel];
  if (value === undefined || value === null) return fallback;
  return value as T;
}

export function normalizeUserId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return value.replace(/^blocks\|/i, "").trim().toLowerCase();
}

export function userCandidateIds(profileItemId?: string, claims?: Record<string, unknown>): string[] {
  const raw = [
    profileItemId,
    claims?.user_id,
    claims?.userId,
    claims?.sub,
    claims?.UserId,
    claims?.itemId
  ];
  return [...new Set(raw.map(normalizeUserId).filter(Boolean))];
}

export function normalizeList<T extends GatewayRecord>(response: unknown, queryName?: string): { items: T[]; totalCount: number } {
  assertNoGraphqlErrors(response);
  const record = response as Record<string, unknown>;
  if (Array.isArray(record.data)) return { items: record.data as T[], totalCount: record.data.length };

  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : undefined;

  const named = queryName && data && data[queryName] && typeof data[queryName] === "object"
    ? data[queryName] as { items?: T[]; totalCount?: number }
    : undefined;

  const nested = named ?? (data
    ? Object.values(data).find((value): value is { items?: T[]; totalCount?: number } => Boolean(value && typeof value === "object" && "items" in value))
    : undefined);

  const items = nested?.items ?? (Array.isArray(data?.items) ? data.items as T[] : undefined) ?? (Array.isArray(record.items) ? record.items as T[] : []) ?? [];
  const totalCount = nested?.totalCount ?? (typeof data?.totalCount === "number" ? data.totalCount : undefined) ?? (typeof record.totalCount === "number" ? record.totalCount : items.length);
  return { items, totalCount };
}

function mutationPayload(response: unknown): { acknowledged?: boolean; message?: string; itemId?: string } {
  const record = response as {
    data?: Record<string, { acknowledged?: boolean; message?: string; itemId?: string }>;
    acknowledged?: boolean;
    message?: string;
    itemId?: string;
  };
  return (record.data ? Object.values(record.data)[0] : record) ?? {};
}

export function assertMutationAccepted(response: unknown): string | undefined {
  assertNoGraphqlErrors(response);
  const payload = mutationPayload(response);
  if (payload.acknowledged === false) {
    throw new Error(payload.message || "The change could not be saved.");
  }
  return payload.itemId;
}

export function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  if (typeof value === "number") return value !== 0;
  return false;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}
