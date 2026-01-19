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

  return `Current time: ${getNowStamp()}`;
}
