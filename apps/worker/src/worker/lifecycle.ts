import { readPersonalItems } from "../personal/index.js";
import { readWeatherSummary, refreshWeather } from "../weather/index.js";
import { readTasksList } from "../tasks/index.js";
import {
  relayUpdateTasks,
  relayHeartbeat,
  relayUpdatePersonal,
  relayUpdateWeather
} from "../relay/index.js";

export function startHeartbeat(getState: () => "online" | "busy") {
  setInterval(() => {
    relayHeartbeat(getState()).catch((err: any) => {
      console.warn("Heartbeat failed:", err?.message ?? err);
    });
  }, 3000);
}

export function startWeatherRefresh() {
  setInterval(() => {
    refreshWeather(false)
      .then(async () => {
        await relayUpdateWeather(await readWeatherSummary());
      })
      .catch((err: any) => {
        console.warn("Weather refresh failed:", err?.message ?? err);
      });
  }, 60 * 60 * 1000);
}

export async function runInitialSync(workerState: "online" | "busy") {
  try {
    await relayUpdateTasks(await readTasksList());
  } catch (err: any) {
    console.warn("Initial tasks sync failed:", err?.message ?? err);
  }

  try {
    await relayUpdatePersonal(await readPersonalItems());
  } catch (err: any) {
    console.warn("Initial personal sync failed:", err?.message ?? err);
  }

  try {
    await refreshWeather(true);
  } catch (err: any) {
    console.warn("Initial weather refresh failed:", err?.message ?? err);
  }
  try {
    await relayUpdateWeather(await readWeatherSummary());
  } catch (err: any) {
    console.warn("Initial weather sync failed:", err?.message ?? err);
  }

  try {
    await relayHeartbeat(workerState);
  } catch (err: any) {
    console.warn("Initial heartbeat failed:", err?.message ?? err);
  }
}
