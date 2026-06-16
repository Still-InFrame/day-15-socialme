"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODELS, type Provider } from "@/lib/models";

const FIELD =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

function Steps({ step }: { step: 1 | 2 }) {
  const items = ["Your business", "Topics"];
  return (
    <div className="mb-6 flex items-center gap-3">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-orange-600 text-white"
                  : done
                    ? "bg-orange-100 text-orange-700"
                    : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`text-sm font-medium ${active ? "text-zinc-900" : "text-zinc-400"}`}
            >
              {label}
            </span>
            {i === 0 && <span className="ml-1 h-px w-6 bg-zinc-200" />}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingForm() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: "",
    expertise: "",
    niche: "",
    ideal_customer: "",
    topics: "",
    ai_provider: "anthropic",
    ai_key: "",
    ai_model: MODELS.anthropic[0].id,
  });

  const [keywords, setKeywords] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function findTopics(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: pErr } = await supabase.from("socialme_profiles").upsert(
        {
          business_name: form.business_name,
          expertise: form.expertise,
          niche: form.niche,
          ideal_customer: form.ideal_customer,
          topics: form.topics,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (pErr) throw new Error(pErr.message);

      const { error: sErr } = await supabase.from("socialme_settings").upsert(
        {
          ai_provider: form.ai_provider,
          ai_key: form.ai_key,
          ai_model: form.ai_model,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (sErr) throw new Error(sErr.message);

      const res = await fetch("/api/recommend", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate topics.");

      setKeywords(json.keywords);
      setPicked(new Set(json.keywords));
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startMonitoring() {
    setBusy(true);
    setError(null);
    try {
      const rows = [...picked].map((term) => ({ term }));
      if (rows.length) {
        const { error } = await supabase
          .from("socialme_keywords")
          .upsert(rows, { onConflict: "user_id,term", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addCustom() {
    const term = custom.trim();
    if (!term) return;
    if (!keywords.includes(term)) setKeywords((k) => [...k, term]);
    setPicked((p) => new Set(p).add(term));
    setCustom("");
  }

  return (
    <div className="animate-in rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <Steps step={step} />

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {step === 2 ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Topics we&apos;ll watch for
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              We&apos;ll scan Hacker News and Lemmy for people asking about these. Tap to toggle, or
              add your own.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  picked.has(k)
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="add your own topic"
              className={FIELD}
            />
            <button
              onClick={addCustom}
              className="rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Add
            </button>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={startMonitoring}
              disabled={busy || picked.size === 0}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition-all hover:bg-orange-700 disabled:opacity-60"
            >
              {busy ? "Setting up…" : `Start monitoring (${picked.size})`}
            </button>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={findTopics} className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Tell us about your business
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              We&apos;ll find people already asking questions you can answer.
            </p>
          </div>

          <div className="space-y-3">
            <input
              required
              value={form.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              placeholder="Business name"
              className={FIELD}
            />
            <textarea
              required
              value={form.expertise}
              onChange={(e) => set("expertise", e.target.value)}
              placeholder="What you do / your expertise (e.g. we build no-code automation for small e-commerce shops)"
              rows={2}
              className={FIELD}
            />
            <input
              value={form.niche}
              onChange={(e) => set("niche", e.target.value)}
              placeholder="Niche / industry (e.g. e-commerce, fitness, SaaS)"
              className={FIELD}
            />
            <input
              value={form.ideal_customer}
              onChange={(e) => set("ideal_customer", e.target.value)}
              placeholder="Ideal customer (e.g. solo founders doing under $1M/yr)"
              className={FIELD}
            />
            <input
              value={form.topics}
              onChange={(e) => set("topics", e.target.value)}
              placeholder="Anything specific to monitor (comma-separated, optional)"
              className={FIELD}
            />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-700">AI provider</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Your key powers topic suggestions and reply drafts. It&apos;s stored on your account
              only.
            </p>
            <div className="space-y-3">
              <select
                value={form.ai_provider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  setForm((f) => ({ ...f, ai_provider: p, ai_model: MODELS[p][0].id }));
                }}
                className={FIELD}
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
              <input
                required
                type="password"
                value={form.ai_key}
                onChange={(e) => set("ai_key", e.target.value)}
                placeholder={form.ai_provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                className={FIELD}
              />
              <select
                value={form.ai_model}
                onChange={(e) => set("ai_model", e.target.value)}
                className={FIELD}
              >
                {MODELS[form.ai_provider as Provider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition-all hover:bg-orange-700 disabled:opacity-60"
          >
            {busy ? "Finding topics…" : "Find my topics"}
          </button>
        </form>
      )}
    </div>
  );
}
