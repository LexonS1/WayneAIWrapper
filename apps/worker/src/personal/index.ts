import { readText } from "../memory/index.js";
import { paths } from "../config/index.js";

export async function readPersonalItems(): Promise<Array<{ key: string; value: string }>> {
  const raw = await readText(paths.PERSONAL);
  if (!raw) return [];

  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const idx = line.indexOf(":");
      if (idx <= 0) return null;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key || !value) return null;
      return { key, value };
    })
    .filter((item): item is { key: string; value: string } => Boolean(item));
}
