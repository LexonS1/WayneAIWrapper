import { config } from "../config/index.js";
import { ensureFiles } from "../memory/index.js";
import { startHeartbeat, startWeatherRefresh, runInitialSync } from "./lifecycle.js";
import { runWorkerLoop } from "./loop.js";

export async function startWorker() {
  await ensureFiles();
  console.log(`Worker started. Polling ${config.RELAY_API_URL} as userId="${config.USER_ID}"`);
  console.log(`Ollama: ${config.OLLAMA_URL} model=${config.OLLAMA_MODEL}`);

  const workerState: { value: "online" | "busy" } = { value: "online" };

  startHeartbeat(() => workerState.value);
  startWeatherRefresh();
  await runInitialSync(workerState.value);
  await runWorkerLoop(workerState);
}
