import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, type Provider } from "@/lib/ai";

// Generates a genuinely-helpful suggested reply for one thread, in the voice of
// the tenant's business, and caches it on the thread row.
export async function POST(req: Request) {
  const { threadId } = (await req.json()) as { threadId?: string };
  if (!threadId) return NextResponse.json({ error: "Missing threadId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: thread } = await supabase
    .from("socialme_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  const { data: profile } = await supabase.from("socialme_profiles").select("*").maybeSingle();
  const { data: settings } = await supabase.from("socialme_settings").select("*").maybeSingle();

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (!settings?.ai_key) {
    return NextResponse.json({ error: "Add your AI API key in Settings." }, { status: 400 });
  }

  const system = `You are the founder of "${profile?.business_name || "a business"}"${
    profile?.expertise ? ` (${profile.expertise})` : ""
  }. Write a genuinely helpful, non-spammy Reddit reply to the post below. Lead with real value and answer the question directly. Only mention your business briefly and naturally if it's truly relevant, and never sound like an ad. Keep it concise (2-5 short paragraphs), friendly, and authentic to Reddit culture. Output only the reply text.`;
  const userMsg = `Subreddit: r/${thread.subreddit}
Title: ${thread.title}
Body: ${thread.selftext || "(no body text)"}

Write the reply.`;

  let draft: string;
  try {
    draft = await callAI({
      provider: settings.ai_provider as Provider,
      key: settings.ai_key,
      model: settings.ai_model || undefined,
      system,
      user: userMsg,
      maxTokens: 700,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  await supabase.from("socialme_threads").update({ ai_draft: draft }).eq("id", threadId);
  return NextResponse.json({ draft });
}
