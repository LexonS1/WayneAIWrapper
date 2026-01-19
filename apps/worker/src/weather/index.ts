import { paths } from "../config/index.js";
import { readText, writeText } from "../memory/index.js";
import { getSettings } from "../settings/index.js";

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

type WeatherApi = {
  current?: {
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    precipitation?: number | null;
    weather_code?: number | null;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    precipitation_sum?: number[];
  };
};

async function readMeta(): Promise<WeatherMeta> {
  try {
    const raw = await readText(paths.WEATHER_META);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMeta(meta: WeatherMeta) {
  await writeText(paths.WEATHER_META, JSON.stringify(meta));
}

async function fetchWeather(): Promise<WeatherApi> {
  const settings = await getSettings();
  const { lat, lon, timezone } = settings.weather;
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
    "&temperature_unit=fahrenheit" +
    `&timezone=${encodeURIComponent(timezone)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch error ${res.status}: ${await res.text()}`);
  return (await res.json()) as WeatherApi;
}

function roundMaybe(value: any) {
  if (value === null || value === undefined) return "?";
  const num = Number(value);
  if (Number.isNaN(num)) return "?";
  return Math.round(num);
}

function buildDayMd(data: WeatherApi) {
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

function buildWeekMd(data: WeatherApi) {
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
  const settings = await getSettings();
  const meta = await readMeta();
  const now = Date.now();
  if (!force && meta.updatedAt && now - meta.updatedAt < settings.weather.ttlMs) return;

  const data = await fetchWeather();
  const current = data?.current ?? {};
  const summary: WeatherMeta = {
    updatedAt: now,
    currentCondition: weatherCodeToText(Number(current.weather_code ?? -1))
  };
  if (Number.isFinite(Number(current.temperature_2m))) {
    summary.currentTempF = Math.round(Number(current.temperature_2m));
  }
  if (Number.isFinite(Number(current.apparent_temperature))) {
    summary.currentFeelsF = Math.round(Number(current.apparent_temperature));
  }
  const dayMd = buildDayMd(data);
  const weekMd = buildWeekMd(data);

  await writeText(paths.WEATHER_DAY, dayMd + "\n");
  await writeText(paths.WEATHER_WEEK, weekMd + "\n");
  await writeMeta(summary);
}

export function shouldRefreshForQuery(text: string) {
  return /\b(weather|forecast|temperature|rain|snow|storm)\b/i.test(text);
}

export async function readWeatherSummary(): Promise<WeatherMeta> {
  return await readMeta();
}
