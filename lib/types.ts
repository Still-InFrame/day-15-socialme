export type Thread = {
  id: string;
  reddit_id: string;
  subreddit: string;
  title: string;
  selftext: string;
  permalink: string;
  author: string;
  num_comments: number;
  score: number;
  created_utc: string | null;
  matched_keyword: string;
  status: "new" | "answered" | "dismissed";
  ai_draft: string;
  // `subreddit` now holds a generic source label (e.g. "Hacker News", "Lemmy · …")
  // and `reddit_id` a generic external id (hn_*/lemmy_*) — kept for schema stability.
  found_at: string;
};
