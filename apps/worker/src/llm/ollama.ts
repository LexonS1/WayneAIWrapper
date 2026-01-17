
import { config } from "../config/index.js";

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
