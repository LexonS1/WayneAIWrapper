
import * as path from "node:path";

export const config = {
  RELAY_API_URL: process.env.RELAY_API_URL,
  RELAY_API_KEY: process.env.RELAY_API_KEY,
  OLLAMA_URL: process.env.OLLAMA_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  USER_ID: process.env.USER_ID || "default",
  POLL_MS: Number(process.env.POLL_MS || 300)
};

const MEM_ROOT = path.join(process.cwd(), "memory");

export const paths = {
  MEM_ROOT,
  PERSONAL: path.join(MEM_ROOT, "personal_data.md"),
  DAILY: path.join(MEM_ROOT, "daily_tasks.md"),
  NOTES: path.join(MEM_ROOT, "notes.md"),
  CONV_DIR: path.join(MEM_ROOT, "conversation"),
  RESET_META: path.join(MEM_ROOT, "meta_daily_reset.txt")
};
