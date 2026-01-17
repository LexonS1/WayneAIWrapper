import Fastify from "fastify";
import { config } from "./config";
import { registerCors } from "./middleware/cors";
import { registerAuth } from "./middleware/auth";
import { registerStatusRoutes } from "./routes/status";
import { registerJobsRoutes } from "./routes/jobs";
import { registerTasksRoutes } from "./routes/tasks";
import { registerPersonalRoutes } from "./routes/personal";
import { registerWorkerRoutes } from "./routes/worker";
import { registerWeatherRoutes } from "./routes/weather";

export async function startServer() {
  const app = Fastify({ logger: true });

  registerCors(app);
  registerAuth(app);
  registerStatusRoutes(app);
  registerJobsRoutes(app);
  registerTasksRoutes(app);
  registerPersonalRoutes(app);
  registerWeatherRoutes(app);
  registerWorkerRoutes(app);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  console.log(`Relay API listening on http://127.0.0.1:${config.PORT}`);
}
