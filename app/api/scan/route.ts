import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAll, isHelpQuestion } from "@/lib/sources";
import { searchRedditViaClaude } from "@/lib/ai";

// Claude web-search can make the scan run long — give it room on serverless.
export const maxDuration = 60;

// On-demand scan: search the open sources (Hacker News, Stack Exchange, Lemmy)
// plus — when the tenant is on Anthropic — Claude's web_search tool over Reddit.
// Keep only question-like posts from the last 5 days, then upsert into
// socialme_threads (ignoring ones we already have, so drafts/status survive).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: kws }, { data: settings }, { data: profile }] = await Promise.all([
    supabase.from("socialme_keywords").select("term"),
    supabase.from("socialme_settings").select("ai_provider,ai_key,ai_model").maybeSingle(),
    supabase.from("socialme_profiles").select("business_name,expertise,niche").maybeSingle(),
  ]);

  const keywords = (kws ?? []).map((k) => k.term).filter(Boolean);
  if (!keywords.length) {
    return NextResponse.json({ error: "No topics to scan. Add some first." }, { status: 400 });
  }

  // Only keep posts from the last 5 days.
  const cutoffSec = Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60;
  const nowIso = new Date().toISOString();

  // 1. Open JSON-API sources (have real timestamps — apply the recency filter).
  const posts = await searchAll(keywords);
  const apiRows = posts
    .filter((p) => isHelpQuestion(p) && p.createdUtc >= cutoffSec)
    .map((p) => {
      const hay = `${p.title} ${p.text}`.toLowerCase();
      const matched = keywords.find((k) => hay.includes(k.toLowerCase())) ?? "";
      return {
        user_id: user.id,
        reddit_id: p.externalId,
        subreddit: p.source,
        title: p.title,
        selftext: p.text.slice(0, 2000),
        permalink: p.url,
        author: p.author,
        num_comments: p.comments,
        score: p.score,
        created_utc: p.createdUtc ? new Date(p.createdUtc * 1000).toISOString() : null,
        matched_keyword: matched,
      };
    });

  // 2. Reddit via Claude web search (Anthropic only; recency handled in the prompt).
  let redditRows: typeof apiRows = [];
  let redditError = "";
  if (settings?.ai_provider === "anthropic" && settings.ai_key) {
    const business = [profile?.business_name, profile?.expertise, profile?.niche]
      .filter(Boolean)
      .join(" — ");
    try {
      const hits = await searchRedditViaClaude({
        key: settings.ai_key,
        model: settings.ai_model || undefined,
        business,
        topics: keywords,
      });
      redditRows = hits
        .filter((h) => h.url && /reddit\.com/i.test(h.url))
        .map((h) => {
          const id = h.url.match(/comments\/([a-z0-9]+)/i)?.[1] ?? h.url;
          const sub = String(h.subreddit ?? "").replace(/^\/?r\//i, "").trim();
          return {
            user_id: user.id,
            reddit_id: `reddit_${id}`.slice(0, 120),
            subreddit: sub ? `Reddit · r/${sub}` : "Reddit",
            title: String(h.title ?? "").slice(0, 300),
            selftext: String(h.snippet ?? "").slice(0, 2000),
            permalink: h.url,
            author: "",
            num_comments: 0,
            score: 0,
            created_utc: nowIso,
            matched_keyword: "",
          };
        });
    } catch (e) {
      redditError = (e as Error).message;
    }
  }

  const rows = [...apiRows, ...redditRows];

  let added = 0;
  if (rows.length) {
    const { error, count } = await supabase
      .from("socialme_threads")
      .upsert(rows, { onConflict: "user_id,reddit_id", ignoreDuplicates: true, count: "exact" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    added = count ?? 0;
  }

  return NextResponse.json({
    scanned: keywords.length,
    matched: rows.length,
    added,
    reddit: redditRows.length,
    redditError: redditError || undefined,
  });
}
