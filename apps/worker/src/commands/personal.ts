import { readText } from "../memory/index.js";
import { paths } from "../config/index.js";
import { buildIndex, parsePersonal, writePersonal } from "../personal/index.js";
import { getSettings } from "../settings/index.js";

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function keywordMatchesQuery(keyword: string, tokens: Set<string>, lower: string) {
  const keyTokens = normalizeTokens(keyword);
  if (!keyTokens.length) return false;
  if (keyTokens.length === 1) {
    const token = keyTokens[0];
    if (!token) return false;
    const noSpace = lower.replace(/\s+/g, "");
    const keywordNoSpace = token.replace(/\s+/g, "");
    return (
      tokens.has(token) ||
      lower.includes(token) ||
      (keywordNoSpace && noSpace.includes(keywordNoSpace))
    );
  }
  return keyTokens.every(token => tokens.has(token));
}

function findMatchingItem(
  items: Array<{ key: string; value: string }>,
  synonyms: Record<string, string[]>,
  query: string
) {
  const lower = query.toLowerCase();
  const tokens = new Set(normalizeTokens(query));

  for (const item of items) {
    const keyLower = item.key.toLowerCase();
    const keywords = [item.key, ...(synonyms[keyLower] ?? [])];
    if (keywords.some(keyword => keywordMatchesQuery(keyword, tokens, lower))) {
      return item;
    }
  }
  return null;
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

  const settings = await getSettings();
  const raw = await readText(paths.PERSONAL);
  const items = parsePersonal(raw);
  const index = buildIndex(items);
  const synonyms = settings.personalSynonyms ?? {};

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
    let synonymItem: { key: string; value: string } | null = null;
    if (existingItem) {
      existingItem.value = value;
    } else {
      synonymItem = findMatchingItem(items, synonyms, key);
      if (synonymItem) {
        synonymItem.value = value;
      } else {
        items.push({ key, value });
      }
    }
    const seen = new Set<string>();
    const deduped = items.filter(item => {
      const norm = item.key.toLowerCase();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
    await writePersonal(deduped);
    const outputKey = existingItem?.key ?? synonymItem?.key ?? key;
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
    const found =
      index.get(key.toLowerCase()) ?? findMatchingItem(items, synonyms, key);
    if (!found) {
      return `I don't have "${key}" yet. Use "set ${key} to ..." to add it.`;
    }
    return `${found.key}: ${found.value}`;
  }

  const wantsLookup =
    /\b(what|how|tell|show|get)\b/i.test(text) && /\b(my|i|am)\b/i.test(text);
  if (wantsLookup) {
    const matched = findMatchingItem(items, synonyms, text);
    if (matched) return `${matched.key}: ${matched.value}`;
  }

  return null;
}

export async function getPersonalValue(key: string): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const settings = await getSettings();
  const raw = await readText(paths.PERSONAL);
  const items = parsePersonal(raw);
  const index = buildIndex(items);
  const synonyms = settings.personalSynonyms ?? {};

  const found =
    index.get(trimmed.toLowerCase()) ?? findMatchingItem(items, synonyms, trimmed);
  if (!found) return null;
  return `${found.key}: ${found.value}`;
}

function calculateAge(birthday: Date, now = new Date()) {
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDiff = now.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
}

export async function getPersonalAge(): Promise<string | null> {
  const settings = await getSettings();
  const raw = await readText(paths.PERSONAL);
  const items = parsePersonal(raw);
  const synonyms = settings.personalSynonyms ?? {};
  const birthdayItem =
    findMatchingItem(items, synonyms, "birthday") ??
    items.find(item => item.key.toLowerCase().includes("birth"));
  if (!birthdayItem) return null;

  const parsed = new Date(birthdayItem.value);
  if (Number.isNaN(parsed.getTime())) {
    return "I have your birthday but couldn't parse it to compute age.";
  }
  const age = calculateAge(parsed);
  return `You are ${age} years old.`;
}

export async function setPersonalValue(key: string, value: string): Promise<string> {
  const trimmedKey = key.trim();
  const trimmedValue = value.trim();
  if (!trimmedKey || !trimmedValue) {
    return "Tell me which personal data key and value to set.";
  }
  const settings = await getSettings();
  const raw = await readText(paths.PERSONAL);
  const items = parsePersonal(raw);
  const synonyms = settings.personalSynonyms ?? {};

  const normalized = trimmedKey.toLowerCase();
  const existingIndex = items.findIndex(item => item.key.toLowerCase() === normalized);
  const existingItem = existingIndex >= 0 ? items[existingIndex] : undefined;
  let synonymItem: { key: string; value: string } | null = null;
  if (existingItem) {
    existingItem.value = trimmedValue;
  } else {
    synonymItem = findMatchingItem(items, synonyms, trimmedKey);
    if (synonymItem) {
      synonymItem.value = trimmedValue;
    } else {
      items.push({ key: trimmedKey, value: trimmedValue });
    }
  }

  const seen = new Set<string>();
  const deduped = items.filter(item => {
    const norm = item.key.toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
  await writePersonal(deduped);
  const outputKey = existingItem?.key ?? synonymItem?.key ?? trimmedKey;
  return `Updated personal data: ${outputKey} = ${trimmedValue}.`;
}
