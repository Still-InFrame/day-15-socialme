// Open, zero-auth "people asking for help" sources. We deliberately favor places
// where folks seek recommendations/answers (not self-promotion):
//   - Stack Exchange (Software Recommendations + Web Apps) — every post is a question
//   - Hacker News — ONLY true "Ask HN:" question threads (no Show HN launches)
//   - Lemmy (the open Reddit) — question-filtered
// Reddit's Data API is gated behind registration, so it's intentionally absent.

const UA = "socialme/1.0 (100-day-ai-challenge)";

// Stack Exchange sites to search. These are help/recommendation-seeking by nature.
const SE_SITES = ["softwarerecs", "webapps"];

export type SourcePost = {
  source: string; // display label, e.g. "Hacker News", "Stack Exchange · softwarerecs"
  externalId: string; // stable dedupe id
  title: string;
  text: string;
  url: string; // link to the discussion/question
  author: string;
  comments: number;
  score: number;
  createdUtc: number; // epoch seconds
  inherentQuestion: boolean; // true when the source guarantees it's a question
};

function clean(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Filters out "I made / launched a thing" self-promotion — the opposite of a help request.
function isPromotional(title: string): boolean {
  return /^\s*(show|launch)\s*hn|^\s*(i|we)\s+(built|made|created|launched|shipped|open-?sourced)|^\s*introducing\b|^\s*launching\b|^\s*\[?(showcase|project|release)\]?/i.test(
    title,
  );
}

// Heuristic: does this read like someone asking for help?
function isQuestionLike(post: { title: string; text: string }): boolean {
  if (/^\s*ask hn/i.test(post.title)) return true;
  if (post.title.includes("?")) return true;
  const t = `${post.title} ${post.text}`.toLowerCase();
  const cues = [
    "how do", "how to", "how can", "what's the", "whats the", "which ", "why ",
    "anyone ", "recommend", "looking for", "suggestion", "advice", "help with",
    "need help", "should i", "best way", "best tool", "where can", "is there",
    "alternative to", "any tips", "tips for", "struggling with", "trying to find",
  ];
  return cues.some((c) => t.includes(c));
}

async function searchHN(keyword: string): Promise<SourcePost[]> {
  const params = new URLSearchParams({
    query: keyword,
    tags: "ask_hn", // genuine "Ask HN:" question threads only
    hitsPerPage: "12",
  });
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.hits ?? [])
      .map(
        (h: {
          objectID: string;
          title?: string;
          story_text?: string;
          author?: string;
          num_comments?: number;
          points?: number;
          created_at_i?: number;
        }): SourcePost => ({
          source: "Hacker News",
          externalId: `hn_${h.objectID}`,
          title: h.title ?? "",
          text: clean(h.story_text),
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          author: h.author ?? "",
          comments: h.num_comments ?? 0,
          score: h.points ?? 0,
          createdUtc: h.created_at_i ?? 0,
          inherentQuestion: true,
        }),
      )
      // Algolia's ask_hn tag occasionally leaks non-Ask posts — keep only real ones.
      .filter((p: SourcePost) => /^\s*ask hn/i.test(p.title));
  } catch {
    return [];
  }
}

async function searchSE(keyword: string): Promise<SourcePost[]> {
  const out: SourcePost[] = [];
  for (const site of SE_SITES) {
    const params = new URLSearchParams({
      order: "desc",
      sort: "creation",
      q: keyword,
      site,
      pagesize: "12",
      filter: "withbody",
    });
    try {
      const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params}`, {
        headers: { "Accept-Encoding": "gzip", "User-Agent": UA },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const i of json.items ?? []) {
        out.push({
          source: `Stack Exchange · ${site}`,
          externalId: `se_${site}_${i.question_id}`,
          title: clean(i.title),
          text: clean(i.body).slice(0, 600),
          url: i.link,
          author: clean(i.owner?.display_name),
          comments: i.answer_count ?? 0,
          score: i.score ?? 0,
          createdUtc: i.creation_date ?? 0,
          inherentQuestion: true,
        });
      }
    } catch {
      // skip this site on error
    }
  }
  return out;
}

type LemmyPostView = {
  post: { id: number; name?: string; body?: string; url?: string; ap_id?: string; published?: string };
  creator?: { name?: string };
  community?: { name?: string };
  counts?: { comments?: number; score?: number };
};

async function searchLemmy(keyword: string): Promise<SourcePost[]> {
  const params = new URLSearchParams({
    q: keyword,
    type_: "Posts",
    sort: "New",
    limit: "12",
    listing_type: "All",
  });
  try {
    const res = await fetch(`https://lemmy.world/api/v3/search?${params}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.posts ?? [])
      .map((pv: LemmyPostView): SourcePost => {
        const pub = pv.post.published ?? "";
        const ms = pub ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(pub) ? pub : `${pub}Z`) : 0;
        return {
          source: pv.community?.name ? `Lemmy · ${pv.community.name}` : "Lemmy",
          externalId: `lemmy_${pv.post.id}`,
          title: pv.post.name ?? "",
          text: clean(pv.post.body),
          url: pv.post.ap_id ?? `https://lemmy.world/post/${pv.post.id}`,
          author: pv.creator?.name ?? "",
          comments: pv.counts?.comments ?? 0,
          score: pv.counts?.score ?? 0,
          createdUtc: Number.isNaN(ms) ? 0 : Math.floor(ms / 1000),
          inherentQuestion: false,
        };
      })
      .filter((p: SourcePost) => p.title);
  } catch {
    return [];
  }
}

// Keep only genuine help-seeking questions (and drop self-promotion).
export function isHelpQuestion(p: SourcePost): boolean {
  if (isPromotional(p.title)) return false;
  return p.inherentQuestion || isQuestionLike(p);
}

// Search every source for every keyword (capped), merge, dedupe by externalId.
export async function searchAll(keywords: string[]): Promise<SourcePost[]> {
  const kws = keywords.slice(0, 6);
  const batches = await Promise.all(
    kws.flatMap((k) => [searchHN(k), searchSE(k), searchLemmy(k)]),
  );
  const seen = new Set<string>();
  const out: SourcePost[] = [];
  for (const batch of batches) {
    for (const p of batch) {
      if (!p.title || seen.has(p.externalId)) continue;
      seen.add(p.externalId);
      out.push(p);
    }
  }
  return out;
}
