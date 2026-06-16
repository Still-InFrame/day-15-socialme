"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Thread } from "@/lib/types";

type Filter = "new" | "answered" | "all";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [s, label] of units) {
    if (secs >= s) return `${Math.floor(secs / s)}${label} ago`;
  }
  return "just now";
}

function sourceMeta(source: string): { label: string; dot: string } {
  if (source.startsWith("Hacker News")) return { label: "Hacker News", dot: "bg-orange-500" };
  if (source.startsWith("Lemmy")) return { label: source, dot: "bg-emerald-500" };
  if (source.startsWith("Stack Exchange")) return { label: source, dot: "bg-blue-500" };
  if (source.startsWith("Reddit")) return { label: source, dot: "bg-red-500" };
  return { label: source, dot: "bg-zinc-400" };
}

// Mirrors the server-side help-question filter, so we can purge rows saved by
// earlier (looser) scans: self-promotion + non-"Ask HN" Hacker News posts.
const PROMO_RE =
  /^\s*(show|launch)\s*hn|^\s*(i|we)\s+(built|made|created|launched|shipped|open-?sourced)|^\s*(introducing|launching)\b/i;
function isJunk(t: Thread): boolean {
  if (PROMO_RE.test(t.title)) return true;
  if (t.subreddit.startsWith("Hacker News") && !/^\s*ask hn/i.test(t.title)) return true;
  return false;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className={`text-2xl font-semibold ${accent ? "text-orange-600" : "text-zinc-900"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
    </div>
  );
}

export function Feed({
  initialThreads,
  topics,
  businessName,
}: {
  initialThreads: Thread[];
  topics: string[];
  businessName: string;
}) {
  const supabase = createClient();
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [filter, setFilter] = useState<Filter>("new");
  const [scanning, setScanning] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("socialme_threads")
      .select("*")
      .gte("created_utc", cutoff)
      .order("created_utc", { ascending: false });
    if (data) setThreads(data as Thread[]);
  }

  async function scan() {
    setScanning(true);
    setNotice(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.error ?? "Scan failed.");
      } else {
        const redditNote =
          typeof json.reddit === "number" && json.reddit > 0
            ? ` (incl. ${json.reddit} from Reddit via Claude)`
            : json.redditError
              ? " · Reddit search unavailable on this model"
              : "";
        setNotice(
          `Scanned ${json.scanned} topic${json.scanned === 1 ? "" : "s"} · ${json.added} new question${json.added === 1 ? "" : "s"} found${redditNote}.`,
        );
        await reload();
      }
    } catch {
      setNotice("Scan failed. Check your connection.");
    } finally {
      setScanning(false);
    }
  }

  async function draft(id: string) {
    setDrafting(id);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.error ?? "Draft failed.");
      } else {
        setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, ai_draft: json.draft } : t)));
      }
    } finally {
      setDrafting(null);
    }
  }

  async function setStatus(id: string, status: Thread["status"]) {
    setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    await supabase.from("socialme_threads").update({ status }).eq("id", id);
  }

  async function cleanup() {
    const junk = threads.filter(isJunk);
    if (!junk.length) return;
    const ids = junk.map((t) => t.id);
    setThreads((ts) => ts.filter((t) => !ids.includes(t.id)));
    setNotice(`Removed ${ids.length} low-value post${ids.length === 1 ? "" : "s"}.`);
    await supabase.from("socialme_threads").delete().in("id", ids);
  }

  const shown = useMemo(() => {
    if (filter === "all") return threads.filter((t) => t.status !== "dismissed");
    if (filter === "answered") return threads.filter((t) => t.status === "answered");
    return threads.filter((t) => t.status === "new");
  }, [threads, filter]);

  const newCount = threads.filter((t) => t.status === "new").length;
  const answeredCount = threads.filter((t) => t.status === "answered").length;
  const junkCount = threads.filter(isJunk).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{businessName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monitoring {topics.length} topic{topics.length === 1 ? "" : "s"} across Hacker News &
            Lemmy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {junkCount > 0 && (
            <button
              onClick={cleanup}
              title="Remove Show HN launches and non-question posts"
              className="rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Clean up {junkCount}
            </button>
          )}
          <button
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition-all hover:bg-orange-700 hover:shadow disabled:opacity-60"
          >
          <svg
            className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            {scanning ? (
              <path
                d="M10 3a7 7 0 107 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M9 3a6 6 0 104.5 10l3.5 3.5M13 9a4 4 0 11-8 0 4 4 0 018 0z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open" value={newCount} accent />
        <StatCard label="Answered" value={answeredCount} />
        <StatCard label="Topics" value={topics.length} />
      </div>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span
              key={t}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
          <svg className="h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          {notice}
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-200">
        {(["new", "answered", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "border-orange-600 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {f}
            {f === "new" && newCount > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 py-20 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">
            {threads.length === 0 ? "No questions yet" : "Nothing in this view"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500">
            {threads.length === 0
              ? "Hit “Scan now” to surface people asking about your topics right now."
              : "Try another tab, or scan again for fresh questions."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => {
            const src = sourceMeta(t.subreddit);
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                    <span className={`h-2 w-2 rounded-full ${src.dot}`} />
                    {src.label}
                  </span>
                  <span className="text-zinc-300">·</span>
                  <span>{timeAgo(t.created_utc)}</span>
                  <span className="text-zinc-300">·</span>
                  <span>{t.num_comments} comments</span>
                  {t.matched_keyword && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">
                      {t.matched_keyword}
                    </span>
                  )}
                  {t.status === "answered" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      answered
                    </span>
                  )}
                  </div>
                  <button
                    onClick={() => setStatus(t.id, "dismissed")}
                    title="Hide this post"
                    className="-mr-1 -mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-md text-lg leading-none text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    ×
                  </button>
                </div>

                <a
                  href={t.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-[15px] font-semibold leading-snug text-zinc-900 hover:text-orange-700"
                >
                  {t.title}
                </a>
                {t.selftext && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                    {t.selftext}
                  </p>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => draft(t.id)}
                    disabled={drafting === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M10 2l1.8 4.7L16.5 8l-4.7 1.8L10 14.5 8.2 9.8 3.5 8l4.7-1.3L10 2z" />
                    </svg>
                    {drafting === t.id ? "Drafting…" : t.ai_draft ? "Regenerate" : "Draft a reply"}
                  </button>
                  <a
                    href={t.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    Open thread ↗
                  </a>
                  {t.status !== "answered" ? (
                    <button
                      onClick={() => setStatus(t.id, "answered")}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      Mark answered
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(t.id, "new")}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>

                {t.ai_draft && (
                  <div className="mt-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        Suggested reply
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(t.ai_draft)}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                      {t.ai_draft}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {topics.length === 0 && (
        <p className="text-sm text-zinc-500">
          No topics tracked yet.{" "}
          <Link href="/settings" className="font-medium text-orange-600 hover:underline">
            Add some in Settings
          </Link>
          .
        </p>
      )}
    </div>
  );
}
