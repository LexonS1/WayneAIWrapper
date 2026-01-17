
import "dotenv/config";
import { config, paths } from "./config/index.js";
import { ensureFiles, resetDailyIfNeeded, readText } from "./memory/index.js";
import { handleDailyTasksCommand, maybeHandleTaskCommand, readTasksList } from "./tasks/index.js";
import { readPersonalItems } from "./personal/index.js";
import { readWeatherSummary, refreshWeather, shouldRefreshForQuery } from "./weather/index.js";
import { appendConversation } from "./conversation/index.js";
import { ollamaGenerate } from "./llm/ollama.js";
import { relayFetchNext, relayComplete, relayError, relayUpdateTasks, relayHeartbeat, relayUpdatePersonal, relayUpdateWeather } from "./relay/index.js";
import { getNowStamp, maybeHandleTimeQuery } from "./utils/time.js";

function buildPrompt(
  userText: string,
  personal: string,
  daily: string,
  notes: string,
  weatherDay: string,
  weatherWeek: string
) {
  return `
You are Wayne, a local personal assistant.
Tone: concise, direct, practical.
Rules:
- Do not invent personal facts not in personal_data.
- Output should only contain the answer, no extra bloat.
- Use daily_tasks when asked about tasks or planning.
- If user asks to add tasks, you may suggest phrasing but the system handles file updates.

[now]
${getNowStamp()}

[weather_today]
${weatherDay || "(empty)"}

[weather_week]
${weatherWeek || "(empty)"}

[personal_data]
${personal || "(empty)"}

[daily_tasks]
${daily || "(empty)"}

[notes]
${notes ? notes.slice(0, 2000) : "(empty)"}  (notes truncated)

User: ${userText}
Wayne:
`.trim();
}

async function main() {
  await ensureFiles();
  console.log(`Worker started. Polling ${config.RELAY_API_URL} as userId="${config.USER_ID}"`);
  console.log(`Ollama: ${config.OLLAMA_URL} model=${config.OLLAMA_MODEL}`);
  let workerState: "online" | "busy" = "online";

  setInterval(() => {
    relayHeartbeat(workerState).catch((err: any) => {
      console.warn("Heartbeat failed:", err?.message ?? err);
    });
  }, 3000);

  setInterval(() => {
    refreshWeather(false)
      .then(async () => {
        await relayUpdateWeather(await readWeatherSummary());
      })
      .catch((err: any) => {
        console.warn("Weather refresh failed:", err?.message ?? err);
      });
  }, 60 * 60 * 1000);
  try {
    await relayUpdateTasks(await readTasksList());
  } catch (err: any) {
    console.warn("Initial tasks sync failed:", err?.message ?? err);
  }

  try {
    await relayUpdatePersonal(await readPersonalItems());
  } catch (err: any) {
    console.warn("Initial personal sync failed:", err?.message ?? err);
  }

  try {
    await refreshWeather(true);
  } catch (err: any) {
    console.warn("Initial weather refresh failed:", err?.message ?? err);
  }
  try {
    await relayUpdateWeather(await readWeatherSummary());
  } catch (err: any) {
    console.warn("Initial weather sync failed:", err?.message ?? err);
  }

  try {
    await relayHeartbeat(workerState);
  } catch (err: any) {
    console.warn("Initial heartbeat failed:", err?.message ?? err);
  }

  while (true) {
    try {
      await resetDailyIfNeeded();

      try {
        await relayHeartbeat(workerState);
      } catch (err: any) {
        console.warn("Heartbeat failed:", err?.message ?? err);
      }

      const next = await relayFetchNext();
      const job = next?.job ?? next;
      if (!job || job.job === null) {
        await new Promise(r => setTimeout(r, config.POLL_MS));
        continue;
      }
      if (job.job === null) {
        await new Promise(r => setTimeout(r, config.POLL_MS));
        continue;
      }

      const id = String(job.id);
      const userText = String(job.message ?? "").trim();
      if (!userText) {
        await relayError(id, "Empty message");
        try {
          await relayHeartbeat("online");
        } catch (err: any) {
          console.warn("Online heartbeat failed:", err?.message ?? err);
        }
        continue;
      }

      workerState = "busy";
      try {
        await relayHeartbeat(workerState);
      } catch (err: any) {
        console.warn("Busy heartbeat failed:", err?.message ?? err);
      }

      if (shouldRefreshForQuery(userText)) {
        try {
          await refreshWeather(false);
          await relayUpdateWeather(await readWeatherSummary());
        } catch (err: any) {
          console.warn("Weather refresh failed:", err?.message ?? err);
        }
      }

      const dailyTasksReply = await handleDailyTasksCommand(userText);
      if (dailyTasksReply) {
        await relayComplete(id, dailyTasksReply);
        await appendConversation(userText, dailyTasksReply);
        await relayUpdateTasks(await readTasksList());
        await relayUpdatePersonal(await readPersonalItems());
        workerState = "online";
        try {
          await relayHeartbeat(workerState);
        } catch (err: any) {
          console.warn("Online heartbeat failed:", err?.message ?? err);
        }
        continue;
      }

      const taskReply = await maybeHandleTaskCommand(userText);
      if (taskReply) {
        await relayComplete(id, taskReply);
        await appendConversation(userText, taskReply);
        await relayUpdateTasks(await readTasksList());
        await relayUpdatePersonal(await readPersonalItems());
        workerState = "online";
        try {
          await relayHeartbeat(workerState);
        } catch (err: any) {
          console.warn("Online heartbeat failed:", err?.message ?? err);
        }
        continue;
      }

      const timeReply = maybeHandleTimeQuery(userText);
      if (timeReply) {
        await relayComplete(id, timeReply);
        await appendConversation(userText, timeReply);
        continue;
      }

      const personal = await readText(paths.PERSONAL);
      const daily = await readText(paths.DAILY);
      const notes = await readText(paths.NOTES);
      const weatherDay = await readText(paths.WEATHER_DAY);
      const weatherWeek = await readText(paths.WEATHER_WEEK);

      const prompt = buildPrompt(userText, personal, daily, notes, weatherDay, weatherWeek);
      const reply = await ollamaGenerate(prompt);

      await relayComplete(id, reply);
      await appendConversation(userText, reply);
      try {
        await relayUpdatePersonal(await readPersonalItems());
      } catch (err: any) {
        console.warn("Personal sync failed:", err?.message ?? err);
      }
      workerState = "online";
      try {
        await relayHeartbeat(workerState);
      } catch (err: any) {
        console.warn("Online heartbeat failed:", err?.message ?? err);
      }
    } catch (err: any) {
      console.error("Worker loop error:", err?.message ?? err);
      await new Promise(r => setTimeout(r, config.POLL_MS));
    }
  }
}

main();
