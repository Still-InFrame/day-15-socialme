import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, extractJson, type Provider } from "@/lib/ai";

// Reads the saved business profile + AI settings, asks the AI for the topics /
// keywords that signal a question or buying intent this business could answer.
// These topics are what we search across Hacker News + Lemmy.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("socialme_profiles").select("*").maybeSingle();
  const { data: settings } = await supabase.from("socialme_settings").select("*").maybeSingle();
  if (!profile?.business_name) {
    return NextResponse.json({ error: "Fill in your business details first." }, { status: 400 });
  }
  if (!settings?.ai_key) {
    return NextResponse.json({ error: "Add your AI API key first." }, { status: 400 });
  }

  const system =
    "You are a market-research strategist. Given a business, produce the search topics/keywords that surface posts where potential customers are asking questions this business could answer (on forums like Hacker News and Lemmy). Favor concrete, searchable phrases over broad single words. Respond with ONLY JSON, no prose.";
  const userMsg = `Business: ${profile.business_name}
What they do / expertise: ${profile.expertise}
Niche: ${profile.niche}
Ideal customer: ${profile.ideal_customer}
Topics to monitor: ${profile.topics}

Return JSON exactly: {"keywords": ["short searchable phrase", ...10 to 14 items]}.
Each phrase should be 1-4 words that someone would actually type when asking for help or recommendations in this niche.`;

  let raw: string;
  try {
    raw = await callAI({
      provider: settings.ai_provider as Provider,
      key: settings.ai_key,
      model: settings.ai_model || undefined,
      system,
      user: userMsg,
      maxTokens: 500,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const parsed = extractJson<{ keywords?: string[] }>(raw) ?? {};
  const keywords = (parsed.keywords ?? [])
    .slice(0, 14)
    .map((k) => String(k).trim())
    .filter(Boolean);

  return NextResponse.json({ keywords });
}
