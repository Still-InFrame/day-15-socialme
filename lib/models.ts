// Selectable AI models per provider. First entry in each list is the default.
// Anthropic IDs are current as of 2026-06 (Opus 4.8 / Sonnet 4.6 / Haiku 4.5).

export type Provider = "anthropic" | "openai";

export const MODELS: Record<Provider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced (recommended)" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 — most capable" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest & lowest cost" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — fast & low cost (recommended)" },
    { id: "gpt-4o", label: "GPT-4o — most capable" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: MODELS.anthropic[0].id,
  openai: MODELS.openai[0].id,
};

// Returns `model` if it's a known id for the provider, else the provider default.
export function normalizeModel(provider: string, model: string): string {
  const list = MODELS[(provider as Provider) in MODELS ? (provider as Provider) : "anthropic"];
  return list.some((m) => m.id === model) ? model : list[0].id;
}
