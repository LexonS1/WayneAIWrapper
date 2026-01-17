
import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";
import { readText } from "../memory/index.js";

function parseTasks(text: string) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("- "))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function formatTasks(tasks: string[]) {
  if (!tasks.length) return "No daily tasks yet.";
  return tasks.map((task, index) => `${index + 1}. ${task}`).join("\n");
}

async function writeTasks(tasks: string[]) {
  const content = tasks.map(task => `- ${task}`).join("\n");
  await fs.writeFile(paths.DAILY, content ? `${content}\n` : "", "utf8");
}

export async function handleDailyTasksCommand(userText: string): Promise<string | null> {
  const text = userText.trim().toLowerCase();
  if (!text) return null;

  const hasTasks = /\b(daily_tasks|daily tasks|tasks?)\b/.test(text);
  if (!hasTasks) return null;

  const wantsList = /\b(list|show|view)\b/.test(text);
  const wantsAdd = /\b(add|create)\b/.test(text);
  const wantsRemove = /\b(remove|delete)\b/.test(text);
  const wantsEdit = /\b(edit|update)\b/.test(text);

  const current = await readText(paths.DAILY);
  const tasks = parseTasks(current);

  if (wantsList) {
    return `Here are your daily tasks:\n${formatTasks(tasks)}`;
  }

  if (wantsAdd) {
    const match = userText.match(/\b(?:add|create)\s+(?:daily\s+)?tasks?\s*[:\-]?\s*(.+)$/i);
    const task = match?.at(1)?.trim();
    if (!task) return "Tell me the task text to add.";

    tasks.push(task);
    await writeTasks(tasks);
    return `Added task ${tasks.length}: "${task}".`;
  }

  if (wantsRemove) {
    const match = userText.match(/\b(?:remove|delete)\s+(?:daily\s+)?tasks?\s*[:\-]?\s*(.+)$/i);
    const target = match?.at(1)?.trim();
    if (!target) return "Tell me the task number or exact text to remove.";

    const index = Number.parseInt(target, 10);
    if (Number.isInteger(index) && index >= 1 && index <= tasks.length) {
      const [removed] = tasks.splice(index - 1, 1);
      await writeTasks(tasks);
      return `Removed task ${index}: "${removed}".`;
    }

    const foundIndex = tasks.findIndex(task => task.toLowerCase() === target.toLowerCase());
    if (foundIndex >= 0) {
      const [removed] = tasks.splice(foundIndex, 1);
      await writeTasks(tasks);
      return `Removed task ${foundIndex + 1}: "${removed}".`;
    }

    return "I could not find that task. Try `list tasks` to see the numbers.";
  }

  if (wantsEdit) {
    const match = userText.match(/\b(?:edit|update)\s+(?:daily\s+)?tasks?\s*[:\-]?\s*(.+)$/i);
    const payload = match?.at(1)?.trim();
    if (!payload) return "Tell me which task to edit and the new text.";

    const numberMatch = payload.match(/^(\d+)\s*(?:to(?:\s+be)?|->|:)\s*(.+)$/i);
    if (numberMatch) {
      const indexText = numberMatch.at(1);
      if (!indexText) return "Tell me the task number to edit.";
      const index = Number.parseInt(indexText, 10);
      const nextText = numberMatch[2]?.trim();
      if (!nextText) return "Tell me the new task text.";
      if (Number.isInteger(index) && index >= 1 && index <= tasks.length) {
        const prev = tasks[index - 1];
        tasks[index - 1] = nextText;
        await writeTasks(tasks);
        return `Updated task ${index}: "${prev}" -> "${nextText}".`;
      }
      return "That task number is out of range. Try `list tasks`.";
    }

    const textMatch = payload.match(/^(.+?)\s*(?:to(?:\s+be)?|->|:)\s*(.+)$/i);
    if (textMatch) {
      const target = textMatch[1]?.trim();
      const nextText = textMatch[2]?.trim();
      if (!target || !nextText) return "Tell me the task text and the new text.";
      const foundIndex = tasks.findIndex(task => task.toLowerCase() === target.toLowerCase());
      if (foundIndex >= 0) {
        const prev = tasks[foundIndex];
        tasks[foundIndex] = nextText;
        await writeTasks(tasks);
        return `Updated task ${foundIndex + 1}: "${prev}" -> "${nextText}".`;
      }
      return "I could not find that task text. Try `list tasks` to see the exact wording.";
    }

    return "Try `edit task 3 to buy milk` or `update task milk to water`.";
  }

  return "I can list, add, or remove daily tasks. Try `list tasks`, `add task ...`, or `remove task 2`.";
}

export async function maybeHandleTaskCommand(userText: string): Promise<string | null> {
  const match = userText.match(/^\s*add\s+task(?:\s+for)?\s*[:\-]?\s*(.+)\s*$/i);
  if (!match) return null;

  const task = match.at(1)?.trim();
  if (!task) return "Tell me the task text to add.";

  const current = await readText(paths.DAILY);
  const tasks = parseTasks(current);
  tasks.push(task);
  await writeTasks(tasks);
  return `Added task ${tasks.length}: "${task}".`;
}

export async function readTasksList(): Promise<string[]> {
  const current = await readText(paths.DAILY);
  return parseTasks(current);
}
