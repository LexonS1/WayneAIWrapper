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
    "You are a classifier. Return ONLY JSON.",
    "Intents: weather.current, tasks.list, tasks.add, personal.get, personal.set, personal.age, none.",
    "If tasks.add, include args.text with the task.",
    "If tasks.list, args can be empty.",
    "If weather-related (temperature, hot/cold, forecast), use weather.current.",
    "If user asks to add something to their list or stuff to do, use tasks.add.",
    "If user asks what they need to do or their list, use tasks.list.",
    "If user asks about personal data (weight, height, name, birthday), use personal.get with args.key.",
    "If user asks to update personal data, use personal.set with args.key and args.value.",
    "If user asks about age or how old they are, use personal.age.",
    personalKeys.length
      ? `Available personal keys: ${personalKeys.join(", ")}`
      : "Available personal keys: (none)",
    "",
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
