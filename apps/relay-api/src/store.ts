import type { Job } from "./types";

export const jobs = new Map<string, Job>();
export const tasksByUser = new Map<string, string[]>();
export const personalByUser = new Map<string, Array<{ key: string; value: string }>>();
export const workerHeartbeatByUser = new Map<string, { lastSeen: string; status: "online" | "busy" }>();
export const weatherByUser = new Map<string, { currentTempF?: number; currentFeelsF?: number; currentCondition?: string; updatedAt?: number }>();
export const jobStreams = new Map<string, Set<import("node:http").ServerResponse>>();
