import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { jobs, jobStreams } from "../store";
import type { Job } from "../types";

export function registerJobsRoutes(app: FastifyInstance) {
  function sendStream(jobId: string, payload: unknown) {
    const streams = jobStreams.get(jobId);
    if (!streams) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of streams) {
      res.write(data);
      const raw = res as any;
      if (typeof raw.flush === "function") {
        raw.flush();
      }
    }
  }

  function closeStreams(jobId: string) {
    const streams = jobStreams.get(jobId);
    if (!streams) return;
    for (const res of streams) {
      res.end();
    }
    jobStreams.delete(jobId);
  }

  app.post("/jobs", async (req) => {
    const body = req.body as any;
    const userId = String(body?.userId ?? "default");
    const message = String(body?.message ?? "").trim();
    if (!message) return { error: "message is required" };

    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      userId,
      message,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };

    jobs.set(job.id, job);
    return { jobId: job.id };
  });

  app.get("/jobs/:id", async (req, reply) => {
    const { id } = req.params as any;
    const job = jobs.get(String(id));
    if (!job) return reply.code(404).send({ error: "Not found" });
    return job;
  });

  app.get("/jobs/:id/stream", async (req, reply) => {
    const { id } = req.params as any;
    const jobId = String(id);
    const job = jobs.get(jobId);
    if (!job) return reply.code(404).send({ error: "Not found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no"
    });
    if (typeof reply.raw.flushHeaders === "function") {
      reply.raw.flushHeaders();
    }
    reply.hijack();

    const streams = jobStreams.get(jobId) ?? new Set();
    streams.add(reply.raw);
    jobStreams.set(jobId, streams);

    reply.raw.write(`data: ${JSON.stringify({ ready: true })}\n\n`);

    req.raw.on("close", () => {
      const set = jobStreams.get(jobId);
      if (!set) return;
      set.delete(reply.raw);
      if (set.size === 0) jobStreams.delete(jobId);
    });
  });

  app.get("/jobs/next", async (req) => {
    const q = req.query as any;
    const userId = String(q?.userId ?? "default");

    for (const job of jobs.values()) {
      if (job.userId === userId && job.status === "queued") {
        job.status = "processing";
        job.updatedAt = new Date().toISOString();
        jobs.set(job.id, job);
        return job;
      }
    }
    return { job: null };
  });

  app.post("/jobs/:id/complete", async (req, reply) => {
    const { id } = req.params as any;
    const job = jobs.get(String(id));
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (job.status === "cancelled") {
      return reply.code(409).send({ error: "Job cancelled" });
    }

    const body = req.body as any;
    const replyText = String(body?.reply ?? "").trim();
    if (!replyText) return reply.code(400).send({ error: "reply is required" });

    job.status = "done";
    job.reply = replyText;
    job.updatedAt = new Date().toISOString();
    jobs.set(job.id, job);

    sendStream(String(id), { done: true });
    closeStreams(String(id));
    return { ok: true };
  });

  app.post("/jobs/:id/error", async (req, reply) => {
    const { id } = req.params as any;
    const job = jobs.get(String(id));
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (job.status === "cancelled") {
      return reply.code(409).send({ error: "Job cancelled" });
    }

    const body = req.body as any;
    job.status = "error";
    job.error = String(body?.error ?? "unknown error");
    job.updatedAt = new Date().toISOString();
    jobs.set(job.id, job);

    sendStream(String(id), { error: job.error, done: true });
    closeStreams(String(id));
    return { ok: true };
  });

  app.post("/jobs/:id/cancel", async (req, reply) => {
    const { id } = req.params as any;
    const job = jobs.get(String(id));
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (job.status === "done" || job.status === "error") {
      return reply.code(409).send({ error: "Job already completed" });
    }

    job.status = "cancelled";
    job.updatedAt = new Date().toISOString();
    jobs.set(job.id, job);

    sendStream(String(id), { cancelled: true, done: true });
    closeStreams(String(id));
    return { ok: true };
  });

  app.post("/jobs/:id/chunk", async (req, reply) => {
    const { id } = req.params as any;
    const job = jobs.get(String(id));
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (job.status === "cancelled") {
      return reply.code(409).send({ error: "Job cancelled" });
    }

    const body = req.body as any;
    const delta = String(body?.delta ?? "");
    if (!delta) return reply.code(400).send({ error: "delta is required" });

    job.reply = `${job.reply ?? ""}${delta}`;
    job.updatedAt = new Date().toISOString();
    jobs.set(job.id, job);

    sendStream(String(id), { delta });
    return { ok: true };
  });
}
