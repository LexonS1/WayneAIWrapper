import type { FastifyInstance } from "fastify";
import { workerHeartbeatByUser } from "../store";

export function registerStatusRoutes(app: FastifyInstance) {
  app.get("/", async () => ({ ok: true, service: "wayne-relay-api" }));

  app.get("/health", async () => ({ ok: true }));

  app.get("/status", async (req) => {
    const q = req.query as any;
    const userId = String(q?.userId ?? "default");
    const heartbeat = workerHeartbeatByUser.get(userId) ?? null;
    return {
      relay: "online",
      workerLastSeen: heartbeat?.lastSeen ?? null,
      workerStatus: heartbeat?.status ?? null
    };
  });
}
