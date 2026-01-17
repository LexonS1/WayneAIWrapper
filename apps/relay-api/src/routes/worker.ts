import type { FastifyInstance } from "fastify";
import { workerHeartbeatByUser } from "../store";

export function registerWorkerRoutes(app: FastifyInstance) {
  app.post("/worker/heartbeat", async (req) => {
    const body = req.body as any;
    const userId = String(body?.userId ?? "default");
    const now = new Date().toISOString();
    const status = body?.status === "busy" ? "busy" : "online";
    workerHeartbeatByUser.set(userId, { lastSeen: now, status });
    return { ok: true };
  });
}
