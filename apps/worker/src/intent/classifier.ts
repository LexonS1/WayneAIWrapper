import { config } from "../config/index.js";

type IntentResult = {
  intent:
    | "weather.current"
    | "tasks.list"
    | "tasks.add"
    | "personal.get"
    | "personal.set"
    | "personal.age"
    | "none";
  args?: Record<string, unknown>;
};

type OllamaResponse = {
  response?: string;
};

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

type ClassifyContext = {
  personalKeys?: string[];
};

export async function classifyIntent(
  userText: string,
  context: ClassifyContext = {}
): Promise<IntentResult> {
  const personalKeys =
    Array.isArray(context.personalKeys) && context.personalKeys.length > 0
      ? context.personalKeys
      : [];

  const prompt = [
    "Return JSON only.",
    "Intents: weather.current, tasks.list, tasks.add, personal.get, personal.set, personal.age, none.",
    "tasks.add -> args.text. personal.get -> args.key. personal.set -> args.key, args.value.",
    personalKeys.length
      ? `Personal keys: ${personalKeys.join(", ")}`
      : "Personal keys: (none)",
    `User: ${userText}`,
    "JSON:"
  ].join("\n");

  const model = config.OLLAMA_INTENT_MODEL || config.OLLAMA_MODEL;
  const res = await fetch(`${config.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        num_predict: 120,
        temperature: 0
      }
    })
  });

  if (!res.ok) {
    return { intent: "none" };
  }

  const data = (await res.json()) as OllamaResponse;
  const raw = (data.response ?? "").trim();
  const jsonText = extractJson(raw);
  if (!jsonText) return { intent: "none" };

  try {
    const parsed = JSON.parse(jsonText) as IntentResult;
    if (!parsed?.intent) return { intent: "none" };
    return parsed;
  } catch {
    return { intent: "none" };
  }
}
