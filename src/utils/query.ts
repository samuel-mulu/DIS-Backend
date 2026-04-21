export function sanitizeQueryValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return undefined;
  }

  return trimmed;
}

export function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const pageRaw = sanitizeQueryValue(query.page);
  const limitRaw = sanitizeQueryValue(query.limit);

  const page = pageRaw ? parseInt(pageRaw, 10) : undefined;
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  return {
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export function parseBooleanQuery(value: unknown): boolean | undefined {
  const raw = sanitizeQueryValue(value);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function parseEnumQuery<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  const raw = sanitizeQueryValue(value);
  if (!raw) return undefined;
  return allowedValues.includes(raw as T) ? (raw as T) : undefined;
}
