import type { FastifyInstance } from "fastify";
import { config } from "../config";

export function registerAuth(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url === "/" || req.url === "/health") return;
    if (req.method === "OPTIONS") return;

    const auth = req.headers.authorization || "";
    const ok = auth === `Bearer ${config.API_KEY}`;
    if (!ok) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
