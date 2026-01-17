export type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled";

export type Job = {
  id: string;
  userId: string;
  message: string;
  status: JobStatus;
  reply?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
