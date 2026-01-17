export function getNowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function maybeHandleTimeQuery(userText: string): string | null {
  const text = userText.trim().toLowerCase();
  if (!text) return null;

  const isTimeQuery = /\b(time|date|today|day)\b/.test(text);
  const isSpecific =
    /what(?:'s| is)\s+the\s+time/.test(text) ||
    /\bcurrent\s+time\b/.test(text) ||
    /what(?:'s| is)\s+the\s+date/.test(text) ||
    /\btoday'?s\s+date\b/.test(text) ||
    /\bwhat\s+day\s+is\s+it\b/.test(text);

  if (!isTimeQuery && !isSpecific) return null;

  return `Current time: ${getNowStamp()}`;
}
