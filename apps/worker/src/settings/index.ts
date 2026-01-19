import { paths } from "../config/index.js";
import { readText } from "../memory/index.js";

export type Settings = {
  weather: {
    lat: number;
    lon: number;
    timezone: string;
    ttlMs: number;
    refreshIntervalMs: number;
  };
  personalSynonyms: Record<string, string[]>;
};

const DEFAULT_SETTINGS: Settings = {
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
};

function toNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function getSettings(): Promise<Settings> {
  const raw = await readText(paths.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const weather: Partial<Settings["weather"]> = parsed.weather ?? {};
    return {
      weather: {
        lat: toNumber(weather.lat, DEFAULT_SETTINGS.weather.lat),
        lon: toNumber(weather.lon, DEFAULT_SETTINGS.weather.lon),
        timezone:
          typeof weather.timezone === "string" && weather.timezone
            ? weather.timezone
            : DEFAULT_SETTINGS.weather.timezone,
        ttlMs: toNumber(weather.ttlMs, DEFAULT_SETTINGS.weather.ttlMs),
        refreshIntervalMs: toNumber(
          weather.refreshIntervalMs,
          DEFAULT_SETTINGS.weather.refreshIntervalMs
        )
      },
      personalSynonyms:
        parsed.personalSynonyms && typeof parsed.personalSynonyms === "object"
          ? parsed.personalSynonyms
          : DEFAULT_SETTINGS.personalSynonyms
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
