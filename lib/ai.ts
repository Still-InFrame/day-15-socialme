// Dual-provider AI client. Each tenant brings their own key + provider choice
// (stored per-user in socialme_settings). We never use a shared/global AI key.

import { DEFAULT_MODELS, type Provider } from "./models";

export type { Provider };

export async function callAI(opts: {
  provider: Provider;
  key: string;
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const provider = opts.provider === "openai" ? "openai" : "anthropic";
  const model = opts.model?.trim() || DEFAULT_MODELS[provider];
  const maxTokens = opts.maxTokens ?? 1024;
  if (!opts.key) throw new Error("No AI API key set. Add one in Settings.");

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": opts.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Anthropic error (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    const json = await res.json();
    return (json.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export type RedditHit = { title: string; url: string; subreddit: string; snippet: string };

// Uses Claude's server-side web_search tool to find recent Reddit question threads
// for the given business/topics. Anthropic-only (web_search is a Claude server tool).
export async function searchRedditViaClaude(opts: {
  key: string;
  model?: string;
  business: string;
  topics: string[];
}): Promise<RedditHit[]> {
  const model = opts.model?.trim() || DEFAULT_MODELS.anthropic;
  const system =
    "You are a Reddit research assistant. Use the web_search tool to find RECENT Reddit threads (prefer the last 5 days) where a real person is asking a question or seeking recommendations that the given business could genuinely answer. Search reddit.com specifically. Exclude news, self-promotion, and threads with no question.";
  const user = `Business: ${opts.business}
Topics: ${opts.topics.join(", ")}

Find up to 10 recent Reddit threads where someone is asking for help or recommendations related to these topics. Run web searches such as: site:reddit.com <topic> (question OR recommend OR "looking for" OR help).

Respond with ONLY a JSON array, no prose:
[{"title": "...", "url": "https://www.reddit.com/r/<sub>/comments/<id>/...", "subreddit": "<sub>", "snippet": "one line on what they're asking"}]
Only include real reddit.com thread URLs you actually found through search. If you find none, return [].`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Claude web search error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  const text = (json.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("\n");
  const parsed = extractJson<RedditHit[]>(text);
  return Array.isArray(parsed) ? parsed : [];
}

// Models like to wrap JSON in prose or code fences — pull out the first JSON value.
export function extractJson<T = unknown>(text: string): T | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
