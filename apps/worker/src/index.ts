import "dotenv/config";
import { promises as fs } from "node:fs";
import * as path from "node:path";

const RELAY_API_URL = process.env.RELAY_API_URL || "http://127.0.0.1:3000";
const RELAY_API_KEY = process.env.RELAY_API_KEY || "dev-secret";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

const USER_ID = process.env.USER_ID || "default";
const POLL_MS = Number(process.env.POLL_MS || 1200);

const MEM_ROOT = path.join(process.cwd(), "memory");
const PERSONAL = path.join(MEM_ROOT, "personal_data.md");
const DAILY = path.join(MEM_ROOT, "daily_tasks.md");
const NOTES = path.join(MEM_ROOT, "notes.md");
const CONV_DIR = path.join(MEM_ROOT, "conversation");
const RESET_META = path.join(MEM_ROOT, "meta_daily_reset.txt");

async function ensureFiles() {
  await fs.mkdir(MEM_ROOT, { recursive: true });
  await fs.mkdir(CONV_DIR, { recursive: true });

  // Create missing files
  for (const p of [PERSONAL, DAILY, NOTES, RESET_META]) {
    try { await fs.access(p); } catch { await fs.writeFile(p, "", "utf8"); }
  }
}

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function resetDailyIfNeeded() {
  const today = todayStamp();
  const last = (await fs.readFile(RESET_META, "utf8")).trim();

  if (last !== today) {
    await fs.writeFile(DAILY, "", "utf8");
    await fs.writeFile(RESET_META, today, "utf8");
  }
}

async function readText(p: string) {
  try { return (await fs.readFile(p, "utf8")).trim(); }
  catch { return ""; }
}

async function appendConversation(userText: string, reply: string) {
  const file = path.join(CONV_DIR, `${todayStamp()}.md`);
  const stamp = new Date().toISOString();
  const block = `\n[${stamp}] USER: ${userText}\n[${stamp}] WAYNE: ${reply}\n`;
  await fs.appendFile(file, block, "utf8");
}

async function ollamaGenerate(prompt: string) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false
    })
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { response?: string };
  return (data.response ?? "").trim();
}

// Very simple task command handler (v1 sanity)
async function maybeHandleTaskCommand(userText: string): Promise<string | null> {
  // Matches: "add task drying clothes" / "add task: drying clothes" / "add task for drying clothes"
  const m = userText.match(/^\s*add\s+task(?:\s+for)?\s*[:\-]?\s*(.+)\s*$/i);
  if (!m) return null;

  const task = m.at(1)?.trim();
  if (!task) return "Tell me the task text to add.";

  const current = await readText(DAILY);
  const line = `- ${task}`;
  const next = current ? `${current}\n${line}` : line;

  await fs.writeFile(DAILY, next.trim() + "\n", "utf8");
  return `Added: "${task}".`;
}

function buildPrompt(userText: string, personal: string, daily: string, notes: string) {
  return `
You are Wayne, a local personal assistant.
Tone: concise, direct, practical.
Rules:
- Do not invent personal facts not in personal_data.
- Use daily_tasks when asked about tasks or planning.
- If user asks to add tasks, you may suggest phrasing but the system handles file updates.

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

async function relayFetchNext() {
  const res = await fetch(`${RELAY_API_URL}/jobs/next?userId=${encodeURIComponent(USER_ID)}`, {
    headers: { Authorization: `Bearer ${RELAY_API_KEY}` }
  });
  if (!res.ok) throw new Error(`Relay next error ${res.status}: ${await res.text()}`);
  return await res.json() as any;
}

async function relayComplete(id: string, replyText: string) {
  const res = await fetch(`${RELAY_API_URL}/jobs/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RELAY_API_KEY}`
    },
    body: JSON.stringify({ reply: replyText })
  });
  if (!res.ok) throw new Error(`Relay complete error ${res.status}: ${await res.text()}`);
}

async function relayError(id: string, error: string) {
  await fetch(`${RELAY_API_URL}/jobs/${encodeURIComponent(id)}/error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RELAY_API_KEY}`
    },
    body: JSON.stringify({ error })
  });
}

async function main() {
  await ensureFiles();
  console.log(`Worker started. Polling ${RELAY_API_URL} as userId="${USER_ID}"`);
  console.log(`Ollama: ${OLLAMA_URL} model=${OLLAMA_MODEL}`);

  while (true) {
    try {
      await resetDailyIfNeeded();

      const next = await relayFetchNext();
      const job = next?.job ?? next; // supports either shape
      if (!job || job.job === null) {
        await new Promise(r => setTimeout(r, POLL_MS));
        continue;
      }
      if (job.job === null) {
        await new Promise(r => setTimeout(r, POLL_MS));
        continue;
      }

      const id = String(job.id);
      const userText = String(job.message ?? "").trim();
      if (!userText) {
        await relayError(id, "Empty message");
        continue;
      }

      // 1) deterministic command handling (adds tasks without LLM)
      const taskReply = await maybeHandleTaskCommand(userText);
      if (taskReply) {
        await relayComplete(id, taskReply);
        await appendConversation(userText, taskReply);
        continue;
      }

      // 2) normal LLM response
      const personal = await readText(PERSONAL);
      const daily = await readText(DAILY);
      const notes = await readText(NOTES);

      const prompt = buildPrompt(userText, personal, daily, notes);
      const reply = await ollamaGenerate(prompt);

      await relayComplete(id, reply);
      await appendConversation(userText, reply);

    } catch (err: any) {
      console.error("Worker loop error:", err?.message ?? err);
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  }
}

main();
