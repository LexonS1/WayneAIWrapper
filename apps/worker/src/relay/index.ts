
import { config } from "../config/index.js";

export async function relayFetchNext() {
  const res = await fetch(
    `${config.RELAY_API_URL}/jobs/next?userId=${encodeURIComponent(config.USER_ID)}`,
    { headers: { Authorization: `Bearer ${config.RELAY_API_KEY}` } }
  );

  if (!res.ok) throw new Error(`Relay next error ${res.status}: ${await res.text()}`);
  return await res.json() as any;
}

export async function relayComplete(id: string, replyText: string) {
  const res = await fetch(`${config.RELAY_API_URL}/jobs/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.RELAY_API_KEY}`
    },
    body: JSON.stringify({ reply: replyText })
  });

  if (res.status === 409) return;
  if (!res.ok) throw new Error(`Relay complete error ${res.status}: ${await res.text()}`);
}

export async function relayError(id: string, error: string) {
  await fetch(`${config.RELAY_API_URL}/jobs/${encodeURIComponent(id)}/error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.RELAY_API_KEY}`
    },
    body: JSON.stringify({ error })
  });
}

export async function relayUpdateTasks(tasks: string[]) {
  const res = await fetch(`${config.RELAY_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.RELAY_API_KEY}`
    },
    body: JSON.stringify({ userId: config.USER_ID, tasks })
  });

  if (!res.ok) throw new Error(`Relay tasks error ${res.status}: ${await res.text()}`);
}
