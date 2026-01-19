import { shouldRefreshForQuery } from "./weather/index.js";
import { getNowStamp } from "./utils/time.js";
import { parsePersonal } from "./personal/index.js";
import { getSettings } from "./settings/index.js";

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

function buildPersonalBlock(
  userText: string,
  personal: string,
  synonyms: Record<string, string[]>
) {
  const items = parsePersonal(personal);
  if (!items.length) return "(empty)";

  const lower = userText.toLowerCase();
  const tokens = new Set(normalizeTokens(userText));
  const wantsPersonal = /\b(personal|profile|bio|about me)\b/i.test(userText);

  const matched = items.filter(item => {
    const keyLower = item.key.toLowerCase();
    const keywords = [item.key, ...(synonyms[keyLower] ?? [])];
    return keywords.some(keyword => keywordMatchesQuery(keyword, tokens, lower));
  });

  if (matched.length > 0) {
    return matched.map(item => `- ${item.key}: ${item.value}`).join("\n");
  }

  if (wantsPersonal) {
    return items.map(item => `- ${item.key}: ${item.value}`).join("\n");
  }

  return "(omitted)";
}

export async function buildPrompt(
  userText: string,
  personal: string,
  daily: string,
  notes: string,
  weatherDay: string,
  weatherWeek: string,
  forceWeather = false
) {
  const settings = await getSettings();
  const needsTasks = /\b(tasks?|daily_tasks|todo|to-do|list)\b/i.test(userText);
  const needsNotes = /\b(notes?|remember|memory)\b/i.test(userText);
  const needsWeather = forceWeather || shouldRefreshForQuery(userText);

  const notesBlock = needsNotes
    ? notes
      ? notes.slice(0, 1000)
      : "(empty)"
    : "(omitted)";

  const weatherDayBlock = needsWeather ? weatherDay || "(empty)" : "(omitted)";
  const weatherWeekBlock = needsWeather ? weatherWeek || "(empty)" : "(omitted)";
  const dailyBlock = needsTasks ? daily || "(empty)" : "(omitted)";
  const personalBlock = buildPersonalBlock(
    userText,
    personal,
    settings.personalSynonyms ?? {}
  );
  return `
You are Wayne, a local personal assistant who is quick, concise, direct, and practical.
Rules:
- Do not invent personal facts not in personal_data.
- Output should only contain the answer, no extra bloat.
- Use daily_tasks when asked about tasks or planning.

[now]
${getNowStamp()}

[weather_today]
${weatherDayBlock}

[weather_week]
${weatherWeekBlock}

[personal_data]
${personalBlock}

[daily_tasks]
${dailyBlock}

[notes]
${notesBlock}

User: ${userText}
Wayne:
`.trim();
}
