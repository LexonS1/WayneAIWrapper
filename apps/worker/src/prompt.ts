import { shouldRefreshForQuery } from "./weather/index.js";
import { getNowStamp } from "./utils/time.js";

export function buildPrompt(
  userText: string,
  personal: string,
  daily: string,
  notes: string,
  weatherDay: string,
  weatherWeek: string
) {
  const needsTasks = /\b(tasks?|daily_tasks|todo|to-do|list)\b/i.test(userText);
  const needsNotes = /\b(notes?|remember|memory)\b/i.test(userText);
  const needsWeather = shouldRefreshForQuery(userText);

  const notesBlock = needsNotes
    ? notes
      ? notes.slice(0, 1000)
      : "(empty)"
    : "(omitted)";

  const weatherDayBlock = needsWeather ? weatherDay || "(empty)" : "(omitted)";
  const weatherWeekBlock = needsWeather ? weatherWeek || "(empty)" : "(omitted)";
  const dailyBlock = needsTasks ? daily || "(empty)" : "(omitted)";
  return `
You are Wayne, a local personal assistant who is quick, concise, direct, and practical.
Rules:
- Do not invent personal facts not in personal_data.
- Output should only contain the answer, no extra bloat.
- Use daily_tasks when asked about tasks or planning.
- If user asks to add tasks, you may suggest phrasing but the system handles file updates.

[now]
${getNowStamp()}

[weather_today]
${weatherDayBlock}

[weather_week]
${weatherWeekBlock}

[personal_data]
${personal || "(empty)"}

[daily_tasks]
${dailyBlock}

[notes]
${notesBlock}

User: ${userText}
Wayne:
`.trim();
}
