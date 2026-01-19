import { readText, writeText } from "../memory/index.js";
import { paths } from "../config/index.js";

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseNotes(raw: string) {
  if (!raw) return [];
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

async function writeNotes(notes: string[]) {
  const content = notes.map(note => `- ${note}`).join("\n");
  await writeText(paths.NOTES, content ? `${content}\n` : "");
}

export async function handleNotesCommand(userText: string): Promise<string | null> {
  const text = userText.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const tokens = normalizeTokens(text);

  const hasNotes = tokens.some(token => token === "note" || token === "notes");
  if (!hasNotes) return null;

  const wantsList = tokens.some(token => token === "list" || token === "show" || token === "view");
  const wantsAdd = tokens.some(token => token === "add" || token === "create");
  const wantsRemove = tokens.some(token => token === "remove" || token === "delete");

  const raw = await readText(paths.NOTES);
  const notes = parseNotes(raw);

  if (wantsList || lower === "notes") {
    if (!notes.length) return "No notes yet.";
    return ["Notes:", ...notes.map((note, index) => `${index + 1}. ${note}`)].join("\n");
  }

  if (wantsAdd) {
    const match = text.match(/\b(?:add|create)\s+notes?\s*[:\-]?\s*(.+)$/i);
    const note = match?.at(1)?.trim();
    if (!note) return "Tell me the note text to add.";
    notes.push(note);
    await writeNotes(notes);
    return `Added note ${notes.length}: "${note}".`;
  }

  if (wantsRemove) {
    const match = text.match(/\b(?:remove|delete)\s+notes?\s*[:\-]?\s*(.+)$/i);
    const target = match?.at(1)?.trim();
    if (!target) return "Tell me the note number or exact text to remove.";

    const index = Number.parseInt(target, 10);
    if (Number.isInteger(index) && index >= 1 && index <= notes.length) {
      const [removed] = notes.splice(index - 1, 1);
      await writeNotes(notes);
      return `Removed note ${index}: "${removed}".`;
    }

    const foundIndex = notes.findIndex(note => note.toLowerCase() === target.toLowerCase());
    if (foundIndex >= 0) {
      const [removed] = notes.splice(foundIndex, 1);
      await writeNotes(notes);
      return `Removed note ${foundIndex + 1}: "${removed}".`;
    }

    return "I could not find that note. Try `list notes` to see the numbers.";
  }

  return "I can list, add, or remove notes. Try `list notes`, `add note ...`, or `remove note 2`.";
}
