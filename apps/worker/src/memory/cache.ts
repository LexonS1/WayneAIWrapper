type CacheEntry = {
  value: string;
  updatedAt: number;
};

const CACHE_TTL_MS = 5000;
const cache = new Map<string, CacheEntry>();

export function getCached(path: string) {
  const entry = cache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > CACHE_TTL_MS) {
    cache.delete(path);
    return null;
  }
  return entry.value;
}

export function setCached(path: string, value: string) {
  cache.set(path, { value, updatedAt: Date.now() });
}
