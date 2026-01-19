import { readText } from "../memory/index.js";
import { paths } from "../config/index.js";
import { buildIndex, parsePersonal, writePersonal } from "../personal/index.js";

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export async function handlePersonalCommand(userText: string): Promise<string | null> {
  const text = userText.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const tokens = normalizeTokens(text);

  const hasPersonalDomain = tokens.some(token =>
    token === "personal" || token === "profile" || token === "data"
  );

  const wantsList =
    hasPersonalDomain &&
    (tokens.some(token => token === "list" || token === "show" || token === "view") ||
      lower.includes("what is in personal data") ||
      lower === "personal data" ||
      lower === "personal");

  const setMatch = text.match(
    /(?:set|update|change)\s+(?:my\s+)?(?:personal\s+data\s+|personal\s+|profile\s+)?(.+?)\s*(?:to|:)\s*(.+)$/i
  );
  const removeMatch = text.match(
    /(?:remove|delete|clear)\s+(?:my\s+)?(?:personal\s+data\s+|personal\s+|profile\s+)?(.+)$/i
  );
  const getMatch =
    text.match(/what(?:'s| is)\s+my\s+(.+)$/i) ||
    text.match(/show\s+my\s+(.+)$/i) ||
    text.match(/get\s+my\s+(.+)$/i);

  const raw = await readText(paths.PERSONAL);
  const items = parsePersonal(raw);
  const index = buildIndex(items);

  if (wantsList) {
    if (!items.length) return "No personal data yet.";
    return ["Personal data:", ...items.map(item => `- ${item.key}: ${item.value}`)].join("\n");
  }

  if (setMatch) {
    const key = setMatch[1]?.trim();
    const value = setMatch[2]?.trim();
    if (!key || !value) return "Tell me which personal data key and value to set.";
    const normalized = key.toLowerCase();
    const existingIndex = items.findIndex(item => item.key.toLowerCase() === normalized);
    const existingItem = existingIndex >= 0 ? items[existingIndex] : undefined;
    if (existingItem) {
      existingItem.value = value;
    } else {
      items.push({ key, value });
    }
    const seen = new Set<string>();
    const deduped = items.filter(item => {
      const norm = item.key.toLowerCase();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
    await writePersonal(deduped);
    const outputKey = existingItem?.key ?? key;
    return `Updated personal data: ${outputKey} = ${value}.`;
  }

  if (removeMatch && hasPersonalDomain) {
    const key = removeMatch[1]?.trim();
    if (!key) return "Tell me which personal data key to remove.";
    const normalized = key.toLowerCase();
    const next = items.filter(item => item.key.toLowerCase() !== normalized);
    if (next.length === items.length) {
      return `I could not find "${key}" in personal data.`;
    }
    await writePersonal(next);
    return `Removed personal data: ${key}.`;
  }

  if (getMatch) {
    const key = getMatch[1]?.trim();
    if (!key) return "Tell me which personal data key to look up.";
    const found = index.get(key.toLowerCase());
    if (!found) {
      return `I don't have "${key}" yet. Use "set ${key} to ..." to add it.`;
    }
    return `${found.key}: ${found.value}`;
  }

  return null;
}
