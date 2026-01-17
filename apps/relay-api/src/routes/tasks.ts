import type { FastifyInstance } from "fastify";
import { tasksByUser } from "../store";

export function registerTasksRoutes(app: FastifyInstance) {
  app.get("/tasks", async (req) => {
    const q = req.query as any;
    const userId = String(q?.userId ?? "default");
    const tasks = tasksByUser.get(userId) ?? [];
    return { tasks };
  });

  app.post("/tasks", async (req, reply) => {
    const body = req.body as any;
    const userId = String(body?.userId ?? "default");
    const tasks = Array.isArray(body?.tasks) ? body.tasks : null;
    if (!tasks) return reply.code(400).send({ error: "tasks is required" });

    const clean = tasks
      .map((task: any) => String(task ?? "").trim())
      .filter(Boolean);

    tasksByUser.set(userId, clean);
    return { ok: true, count: clean.length };
  });
}
