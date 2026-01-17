import type { FastifyInstance } from "fastify";
import { config } from "../config";

export function registerAuth(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url === "/" || req.url === "/health") return;
    if (req.method === "OPTIONS") return;

    const auth = req.headers.authorization || "";
    const url = req.raw.url || "";
    const token = (req.query as any)?.token ?? "";
    const isStream = req.method === "GET" && url.includes("/stream");
    const ok =
      auth === `Bearer ${config.API_KEY}` ||
      (isStream && token === config.API_KEY);
    if (!ok) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
