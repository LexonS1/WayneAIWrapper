
import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";
import { readText } from "../memory/index.js";

export function parseTasks(text: string) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("- "))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

export function formatTasks(tasks: string[]) {
  if (!tasks.length) return "No daily tasks yet.";
  return tasks.map((task, index) => `${index + 1}. ${task}`).join("\n");
}

export async function writeTasks(tasks: string[]) {
  const content = tasks.map(task => `- ${task}`).join("\n");
  await fs.writeFile(paths.DAILY, content ? `${content}\n` : "", "utf8");
}

export async function readTasksList(): Promise<string[]> {
  const current = await readText(paths.DAILY);
  return parseTasks(current);
}
