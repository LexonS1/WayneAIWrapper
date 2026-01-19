export function maybeHandleHelpQuery(userText: string): string | null {
  const text = userText.trim().toLowerCase();
  if (!text) return null;
  const tokens = text
    .replace(/[^a-z0-9_/]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const wantsHelp =
    tokens.includes("help") ||
    tokens.includes("/help") ||
    tokens.includes("commands") ||
    text.includes("what can you do") ||
    text.includes("what do you do") ||
    text.includes("list commands");
  if (!wantsHelp) return null;

  return [
    "Here are some things you can ask:",
    "- Tasks: list tasks, add task <text>, remove task <num|text>, edit task <num> to <text>",
    "- Time/date: what's the time, what's the date, what day is it",
    "- Weather: weather, forecast, temperature",
    "- Personal data: list personal data, set my weight to 180, what's my name",
    "- Notes: show notes"
  ].join("\n");
}
