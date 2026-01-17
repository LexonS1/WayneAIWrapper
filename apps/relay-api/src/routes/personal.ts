import type { FastifyInstance } from "fastify";
import { personalByUser } from "../store";

export function registerPersonalRoutes(app: FastifyInstance) {
  app.get("/personal", async (req) => {
    const q = req.query as any;
    const userId = String(q?.userId ?? "default");
    const items = personalByUser.get(userId) ?? [];
    return { items };
  });

  app.post("/personal", async (req, reply) => {
    const body = req.body as any;
    const userId = String(body?.userId ?? "default");
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) return reply.code(400).send({ error: "items is required" });

    const clean = items
      .map((item: any) => ({
        key: String(item?.key ?? "").trim(),
        value: String(item?.value ?? "").trim()
      }))
      .filter(item => item.key && item.value);

    personalByUser.set(userId, clean);
    return { ok: true, count: clean.length };
  });
}
