
import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";

export async function ensureFiles() {
  await fs.mkdir(paths.MEM_ROOT, { recursive: true });
  await fs.mkdir(paths.CONV_DIR, { recursive: true });

  for (const p of [
    paths.PERSONAL,
    paths.DAILY,
    paths.NOTES,
    paths.WEATHER_DAY,
    paths.WEATHER_WEEK,
    paths.WEATHER_META,
    paths.RESET_META
  ]) {
    try {
      await fs.access(p);
    } catch {
      await fs.writeFile(p, p.endsWith(".json") ? "{}" : "", "utf8");
    }
  }
}

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function resetDailyIfNeeded() {
  const today = todayStamp();
  const last = (await fs.readFile(paths.RESET_META, "utf8")).trim();

  if (last != today) {
    await fs.writeFile(paths.DAILY, "", "utf8");
    await fs.writeFile(paths.RESET_META, today, "utf8");
  }
}

export async function readText(p: string) {
  try {
    return (await fs.readFile(p, "utf8")).trim();
  } catch {
    return "";
  }
}
