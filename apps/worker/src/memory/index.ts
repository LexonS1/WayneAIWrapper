
import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";
import { getCached, setCached } from "./cache.js";

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
    paths.SETTINGS,
    paths.RESET_META
  ]) {
    try {
      await fs.access(p);
    } catch {
      if (p === paths.SETTINGS) {
        const defaults = JSON.stringify({
          weather: {
            lat: 30.2241,
            lon: -92.0198,
            timezone: "America/Chicago",
            ttlMs: 30 * 60 * 1000,
            refreshIntervalMs: 60 * 60 * 1000
          },
          personalSynonyms: {
            weight: ["weight", "weigh", "heavy", "pounds", "lbs", "lb"],
            height: ["height", "tall"],
            name: ["name", "called"],
            birthday: ["birthday", "born", "birth"]
          }
        });
        await fs.writeFile(p, `${defaults}\n`, "utf8");
      } else {
        await fs.writeFile(p, p.endsWith(".json") ? "{}" : "", "utf8");
      }
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
  const last = await readText(paths.RESET_META);

  if (last != today) {
    await writeText(paths.DAILY, "");
    await writeText(paths.RESET_META, today);
  }
}

export async function readText(p: string) {
  const cached = getCached(p);
  if (cached !== null) return cached;
  try {
    const next = (await fs.readFile(p, "utf8")).trim();
    setCached(p, next);
    return next;
  } catch {
    return "";
  }
}

export async function writeText(p: string, content: string) {
  await fs.writeFile(p, content, "utf8");
  setCached(p, content.trim());
}
