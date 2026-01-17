import { promises as fs } from "node:fs";
import { paths } from "../config/index.js";

const LAT = 30.2241;
const LON = -92.0198;
const TZ = "America/Chicago";
const TTL_MS = 30 * 60 * 1000;

function weatherCodeToText(code: number) {
  const map: Record<number, string> = {
    0: "clear",
    1: "mostly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    56: "light freezing drizzle",
    57: "dense freezing drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    66: "light freezing rain",
    67: "heavy freezing rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    77: "snow grains",
    80: "rain showers",
    81: "heavy rain showers",
    82: "violent rain showers",
    85: "snow showers",
    86: "heavy snow showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "thunderstorm with heavy hail"
  };
  return map[code] ?? `code ${code}`;
}

type WeatherMeta = {
  updatedAt?: number;
  currentTempF?: number;
  currentFeelsF?: number;
  currentCondition?: string;
};

async function readMeta(): Promise<WeatherMeta> {
  try {
    const raw = await fs.readFile(paths.WEATHER_META, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function writeMeta(meta: WeatherMeta) {
  await fs.writeFile(paths.WEATHER_META, JSON.stringify(meta), "utf8");
}

async function fetchWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${LAT}&longitude=${LON}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
    "&temperature_unit=fahrenheit" +
    `&timezone=${encodeURIComponent(TZ)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch error ${res.status}: ${await res.text()}`);
  return await res.json();
}

function roundMaybe(value: any) {
  if (value === null || value === undefined) return "?";
  const num = Number(value);
  if (Number.isNaN(num)) return "?";
  return Math.round(num);
}

function buildDayMd(data: any) {
  const current = data?.current ?? {};
  const daily = data?.daily ?? {};
  const todayHi = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
  const todayLo = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
  const todayCode = Array.isArray(daily.weather_code) ? daily.weather_code[0] : null;

  const parts = [
    `Updated: ${new Date().toISOString()}`,
    "Location: Lafayette, LA",
    `Current: ${roundMaybe(current.temperature_2m)} F (feels like ${roundMaybe(current.apparent_temperature)} F), ${weatherCodeToText(Number(current.weather_code ?? -1))}`,
    `Precipitation: ${current.precipitation ?? "?"} mm`,
    `Today: High ${roundMaybe(todayHi)} F / Low ${roundMaybe(todayLo)} F, ${weatherCodeToText(Number(todayCode ?? -1))}`
  ];

  return parts.join("\n");
}

function buildWeekMd(data: any) {
  const daily = data?.daily ?? {};
  const times: string[] = daily.time ?? [];
  const highs: number[] = daily.temperature_2m_max ?? [];
  const lows: number[] = daily.temperature_2m_min ?? [];
  const codes: number[] = daily.weather_code ?? [];
  const precip: number[] = daily.precipitation_sum ?? [];

  const lines = [
    `Updated: ${new Date().toISOString()}`,
    "Location: Lafayette, LA",
    "",
    "7-Day:"
  ];

  for (let i = 0; i < Math.min(7, times.length); i += 1) {
    const date = times[i] ?? "unknown";
    const hi = roundMaybe(highs[i]);
    const lo = roundMaybe(lows[i]);
    const code = codes[i] ?? -1;
    const rain = precip[i] ?? "?";
    lines.push(`- ${date}: ${weatherCodeToText(Number(code))}, High ${hi} F / Low ${lo} F, Precip ${rain} mm`);
  }

  return lines.join("\n");
}

export async function refreshWeather(force = false) {
  const meta = await readMeta();
  const now = Date.now();
  if (!force && meta.updatedAt && now - meta.updatedAt < TTL_MS) return;

  const data = await fetchWeather();
  const current = data?.current ?? {};
  const summary: WeatherMeta = {
    updatedAt: now,
    currentTempF: Number.isFinite(Number(current.temperature_2m))
      ? Math.round(Number(current.temperature_2m))
      : undefined,
    currentFeelsF: Number.isFinite(Number(current.apparent_temperature))
      ? Math.round(Number(current.apparent_temperature))
      : undefined,
    currentCondition: weatherCodeToText(Number(current.weather_code ?? -1))
  };
  const dayMd = buildDayMd(data);
  const weekMd = buildWeekMd(data);

  await fs.writeFile(paths.WEATHER_DAY, dayMd + "\n", "utf8");
  await fs.writeFile(paths.WEATHER_WEEK, weekMd + "\n", "utf8");
  await writeMeta(summary);
}

export function shouldRefreshForQuery(text: string) {
  return /\b(weather|forecast|temperature|rain|snow|storm)\b/i.test(text);
}

export async function readWeatherSummary(): Promise<WeatherMeta> {
  return await readMeta();
}
