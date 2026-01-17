
import "dotenv/config";
import { config, paths } from "./config/index.js";
import { ensureFiles, resetDailyIfNeeded, readText } from "./memory/index.js";
import { handleDailyTasksCommand, maybeHandleTaskCommand } from "./tasks/index.js";
import { appendConversation } from "./conversation/index.js";
import { ollamaGenerate } from "./llm/ollama.js";
import { relayFetchNext, relayComplete, relayError } from "./relay/index.js";
import { getNowStamp, maybeHandleTimeQuery } from "./utils/time.js";

function buildPrompt(userText: string, personal: string, daily: string, notes: string) {
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

  while (true) {
    try {
      await resetDailyIfNeeded();

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
        continue;
      }

      const dailyTasksReply = await handleDailyTasksCommand(userText);
      if (dailyTasksReply) {
        await relayComplete(id, dailyTasksReply);
        await appendConversation(userText, dailyTasksReply);
        continue;
      }

      const taskReply = await maybeHandleTaskCommand(userText);
      if (taskReply) {
        await relayComplete(id, taskReply);
        await appendConversation(userText, taskReply);
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

      const prompt = buildPrompt(userText, personal, daily, notes);
      const reply = await ollamaGenerate(prompt);

      await relayComplete(id, reply);
      await appendConversation(userText, reply);
    } catch (err: any) {
      console.error("Worker loop error:", err?.message ?? err);
      await new Promise(r => setTimeout(r, config.POLL_MS));
    }
  }
}

main();
