import type { FastifyInstance } from "fastify";

export function registerCors(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}
