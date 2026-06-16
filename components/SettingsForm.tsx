"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODELS, normalizeModel, type Provider } from "@/lib/models";

type Settings = { ai_provider: string; ai_model: string };
type Kw = { id: string; term: string };

const FIELD =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export function SettingsForm({
  initialSettings,
  hasSavedKey,
  initialKws,
}: {
  initialSettings: Settings;
  hasSavedKey: boolean;
  initialKws: Kw[];
}) {
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings>(() => ({
    ai_provider: initialSettings.ai_provider,
    ai_model: normalizeModel(initialSettings.ai_provider, initialSettings.ai_model),
  }));
  const [aiKey, setAiKey] = useState("");
  const [keyDirty, setKeyDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [kws, setKws] = useState<Kw[]>(initialKws);
  const [newKw, setNewKw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    setErr(null);
    const payload: { ai_provider: string; ai_model: string; updated_at: string; ai_key?: string } = {
      ai_provider: settings.ai_provider,
      ai_model: settings.ai_model,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the stored key if the user actually typed a new one.
    if (keyDirty) payload.ai_key = aiKey;
    const { error } = await supabase
      .from("socialme_settings")
      .upsert(payload, { onConflict: "user_id" });
    if (error) setErr(error.message);
    else {
      setSaved(true);
      setKeyDirty(false);
      setTimeout(() => setSaved(false), 2000);
    }
    setSavingKey(false);
  }

  async function removeKw(k: Kw) {
    setKws((xs) => xs.filter((x) => x.id !== k.id));
    await supabase.from("socialme_keywords").delete().eq("id", k.id);
  }

  async function addKw() {
    const term = newKw.trim();
    if (!term) return;
    const { data, error } = await supabase
      .from("socialme_keywords")
      .upsert({ term }, { onConflict: "user_id,term" })
      .select()
      .single();
    if (error) setErr(error.message);
    else if (data) {
      setKws((xs) => [...xs.filter((x) => x.term !== term), data as Kw]);
      setNewKw("");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose your AI provider and manage the topics socialme watches.
        </p>
      </div>
      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {err}
        </p>
      )}

      <form onSubmit={saveSettings} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700">AI provider</h2>
        <select
          value={settings.ai_provider}
          onChange={(e) => {
            const p = e.target.value as Provider;
            setSettings((s) => ({ ...s, ai_provider: p, ai_model: MODELS[p][0].id }));
          }}
          className={FIELD}
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
        <input
          type="password"
          value={aiKey}
          onChange={(e) => {
            setAiKey(e.target.value);
            setKeyDirty(true);
          }}
          placeholder={hasSavedKey && !keyDirty ? "•••••••••• (saved — type to replace)" : "API key"}
          className={FIELD}
        />
        <select
          value={settings.ai_model}
          onChange={(e) => setSettings((s) => ({ ...s, ai_model: e.target.value }))}
          className={FIELD}
        >
          {MODELS[settings.ai_provider as Provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={savingKey}
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-600/20 transition-all hover:bg-orange-700 disabled:opacity-60"
        >
          {savingKey ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-zinc-700">Tracked topics</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Searched across Hacker News and Lemmy each time you scan.
        </p>
        <div className="flex flex-wrap gap-2">
          {kws.map((k) => (
            <span
              key={k.id}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
            >
              {k.term}
              <button onClick={() => removeKw(k)} className="text-zinc-400 hover:text-red-600">
                ×
              </button>
            </span>
          ))}
          {kws.length === 0 && <span className="text-sm text-zinc-400">No topics yet.</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKw())}
            placeholder="add a topic or phrase"
            className={FIELD}
          />
          <button
            onClick={addKw}
            className="rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
