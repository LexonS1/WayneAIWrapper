
import { config } from "../config/index.js";

type OllamaStreamChunk = {
  response?: string;
  done?: boolean;
};

export async function ollamaGenerate(prompt: string) {
  const res = await fetch(`${config.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        num_predict: 200,
        temperature: 0.4,
        top_p: 0.9
      }
    })
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { response?: string };
  return (data.response ?? "").trim();
}

export async function ollamaGenerateStream(
  prompt: string,
  onToken: (delta: string) => void
) {
  const res = await fetch(`${config.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.OLLAMA_MODEL,
      prompt,
      stream: true,
      options: {
        num_predict: 200,
        temperature: 0.4,
        top_p: 0.9
      }
    })
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Ollama stream not available");

  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);

    let idx = buffer.indexOf("\n");
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");

      if (!line) continue;
      const chunk = JSON.parse(line) as OllamaStreamChunk;
      if (chunk.response) {
        full += chunk.response;
        onToken(chunk.response);
      }
      if (chunk.done) {
        return full.trim();
      }
    }
  }

  return full.trim();
}
