import { promises as fs } from "node:fs";
import { readText } from "../memory/index.js";
import { paths } from "../config/index.js";

export type PersonalItem = { key: string; value: string };

export function parsePersonal(raw: string): PersonalItem[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map(line => line.trim().replace(/^\s*-\s*/, ""))
    .filter(Boolean)
    .map(line => {
      const idx = line.indexOf(":");
      if (idx <= 0) return null;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key || !value) return null;
      return { key, value };
    })
    .filter((item): item is PersonalItem => Boolean(item));
}

export function buildIndex(items: PersonalItem[]) {
  const map = new Map<string, PersonalItem>();
  for (const item of items) {
    const normalized = item.key.toLowerCase();
    if (!map.has(normalized)) {
      map.set(normalized, item);
    }
  }
  return map;
}

export async function writePersonal(items: PersonalItem[]) {
  const content = items.map(item => `- ${item.key}: ${item.value}`).join("\n");
  await fs.writeFile(paths.PERSONAL, content ? `${content}\n` : "", "utf8");
}

export async function readPersonalItems(): Promise<PersonalItem[]> {
  const raw = await readText(paths.PERSONAL);
  return parsePersonal(raw);
}
