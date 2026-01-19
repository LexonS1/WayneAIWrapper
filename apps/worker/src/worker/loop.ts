import { config, paths } from "../config/index.js";
import { resetDailyIfNeeded, readText } from "../memory/index.js";
import { handleDailyTasksCommand, maybeHandleTaskCommand } from "../commands/tasks.js";
import { readTasksList } from "../tasks/index.js";
import { handlePersonalCommand } from "../commands/personal.js";
import { readPersonalItems } from "../personal/index.js";
import { readWeatherSummary, refreshWeather, shouldRefreshForQuery } from "../weather/index.js";
import { appendConversation } from "../conversation/index.js";
import { ollamaGenerateStream } from "../llm/ollama.js";
import {
  relayFetchNext,
  relayComplete,
  relayError,
  relayUpdateTasks,
  relayHeartbeat,
  relayUpdatePersonal,
  relayUpdateWeather,
  relayStreamChunk
} from "../relay/index.js";
import { maybeHandleTimeQuery } from "../commands/time.js";
import { buildPrompt } from "../prompt.js";
import { maybeHandleHelpQuery } from "../commands/help.js";

export async function runWorkerLoop(workerState: { value: "online" | "busy" }) {
  while (true) {
    try {
      await resetDailyIfNeeded();

      try {
        await relayHeartbeat(workerState.value);
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

      workerState.value = "busy";
      try {
        await relayHeartbeat(workerState.value);
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
        console.log(`Command handled: tasks (daily) text="${userText}"`);
        await relayComplete(id, dailyTasksReply);
        await appendConversation(userText, dailyTasksReply);
        await relayUpdateTasks(await readTasksList());
        await relayUpdatePersonal(await readPersonalItems());
        workerState.value = "online";
        try {
          await relayHeartbeat(workerState.value);
        } catch (err: any) {
          console.warn("Online heartbeat failed:", err?.message ?? err);
        }
        continue;
      }

      const taskReply = await maybeHandleTaskCommand(userText);
      if (taskReply) {
        console.log(`Command handled: tasks (add) text="${userText}"`);
        await relayComplete(id, taskReply);
        await appendConversation(userText, taskReply);
        await relayUpdateTasks(await readTasksList());
        await relayUpdatePersonal(await readPersonalItems());
        workerState.value = "online";
        try {
          await relayHeartbeat(workerState.value);
        } catch (err: any) {
          console.warn("Online heartbeat failed:", err?.message ?? err);
        }
        continue;
      }

      const timeReply = maybeHandleTimeQuery(userText);
      if (timeReply) {
        console.log(`Command handled: time/date text="${userText}"`);
        await relayComplete(id, timeReply);
        await appendConversation(userText, timeReply);
        continue;
      }

      const personalReply = await handlePersonalCommand(userText);
      if (personalReply) {
        console.log(`Command handled: personal text="${userText}"`);
        await relayComplete(id, personalReply);
        await appendConversation(userText, personalReply);
        await relayUpdatePersonal(await readPersonalItems());
        continue;
      }

      const helpReply = maybeHandleHelpQuery(userText);
      if (helpReply) {
        console.log(`Command handled: help text="${userText}"`);
        await relayComplete(id, helpReply);
        await appendConversation(userText, helpReply);
        continue;
      }

      const personal = await readText(paths.PERSONAL);
      const daily = await readText(paths.DAILY);
      const notes = await readText(paths.NOTES);
      const weatherDay = await readText(paths.WEATHER_DAY);
      const weatherWeek = await readText(paths.WEATHER_WEEK);

      const prompt = buildPrompt(userText, personal, daily, notes, weatherDay, weatherWeek);
      let pendingStream = "";
      let lastFlushAt = Date.now();
      const flushIntervalMs = 60;
      const flushStream = (force = false) => {
        if (!pendingStream) return;
        const ageMs = Date.now() - lastFlushAt;
        if (!force && ageMs < flushIntervalMs && pendingStream.length < 32) return;
        const chunk = pendingStream;
        pendingStream = "";
        lastFlushAt = Date.now();
        relayStreamChunk(id, chunk).catch((err: any) => {
          console.warn("Relay chunk failed:", err?.message ?? err);
        });
      };

      const reply = await ollamaGenerateStream(prompt, (delta) => {
        pendingStream += delta;
        flushStream(false);
      });
      flushStream(true);

      await relayComplete(id, reply);
      await appendConversation(userText, reply);
      try {
        await relayUpdatePersonal(await readPersonalItems());
      } catch (err: any) {
        console.warn("Personal sync failed:", err?.message ?? err);
      }
      workerState.value = "online";
      try {
        await relayHeartbeat(workerState.value);
      } catch (err: any) {
        console.warn("Online heartbeat failed:", err?.message ?? err);
      }
    } catch (err: any) {
      console.error("Worker loop error:", err?.message ?? err);
      await new Promise(r => setTimeout(r, config.POLL_MS));
    }
  }
}
