import type { FastifyInstance } from "fastify";
import { weatherByUser } from "../store";

export function registerWeatherRoutes(app: FastifyInstance) {
  app.get("/weather", async (req) => {
    const q = req.query as any;
    const userId = String(q?.userId ?? "default");
    const summary = weatherByUser.get(userId) ?? {};
    return { summary };
  });

  app.post("/weather", async (req, reply) => {
    const body = req.body as any;
    const userId = String(body?.userId ?? "default");
    const summary = body?.summary ?? null;
    if (!summary) return reply.code(400).send({ error: "summary is required" });

    const clean = {
      currentTempF: Number.isFinite(Number(summary.currentTempF))
        ? Number(summary.currentTempF)
        : undefined,
      currentFeelsF: Number.isFinite(Number(summary.currentFeelsF))
        ? Number(summary.currentFeelsF)
        : undefined,
      currentCondition: String(summary.currentCondition ?? "").trim() || undefined,
      updatedAt: Number.isFinite(Number(summary.updatedAt)) ? Number(summary.updatedAt) : undefined
    };

    weatherByUser.set(userId, clean);
    return { ok: true };
  });
}
