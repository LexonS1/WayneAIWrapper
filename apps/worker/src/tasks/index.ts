
import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";
import { readText } from "../memory/index.js";

export async function maybeHandleTaskCommand(userText: string): Promise<string | null> {
  const match = userText.match(/^\s*add\s+task(?:\s+for)?\s*[:\-]?\s*(.+)\s*$/i);
  if (!match) return null;

  const task = match.at(1)?.trim();
  if (!task) return "Tell me the task text to add.";

  const current = await readText(paths.DAILY);
  const line = `- ${task}`;
  const next = current ? `${current}\n${line}` : line;

  await fs.writeFile(paths.DAILY, next.trim() + "\n", "utf8");
  return `Added: "${task}".`;
}
