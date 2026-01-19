import { getNowStamp } from "../utils/time.js";

export function maybeHandleTimeQuery(userText: string): string | null {
  const text = userText.trim().toLowerCase();
  if (!text) return null;

  const isTimeQuery =
    /what(?:'s| is)\s+the\s+time/.test(text) ||
    /\bcurrent\s+time\b/.test(text) ||
    /\btime\s+is\s+it\b/.test(text) ||
    /\bwhat\s+time\b/.test(text);
  const isDateQuery =
    /what(?:'s| is)\s+the\s+date/.test(text) ||
    /\btoday'?s\s+date\b/.test(text) ||
    /\bwhat\s+day\s+is\s+it\b/.test(text) ||
    /\bwhat'?s\s+today\b/.test(text);

  if (!isTimeQuery && !isDateQuery) return null;

  const now = getNowStamp();
  if (isDateQuery && !isTimeQuery) {
    const dateOnly = now.split(" ")[0] ?? now;
    return `Current date: ${dateOnly}`;
  }
  const timeOnly = now.split(" ")[1] ?? now;
  const parts = timeOnly.split(":");
  const hhmm = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : timeOnly;
  return `Current time: ${hhmm}`;
}
