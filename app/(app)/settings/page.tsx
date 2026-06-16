import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: kws }] = await Promise.all([
    supabase.from("socialme_settings").select("ai_provider,ai_key,ai_model").maybeSingle(),
    supabase.from("socialme_keywords").select("id,term").order("term"),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <SettingsForm
        initialSettings={{
          ai_provider: settings?.ai_provider ?? "anthropic",
          ai_model: settings?.ai_model ?? "",
        }}
        // Never ship the real key to the client; just signal whether one exists.
        hasSavedKey={Boolean(settings?.ai_key)}
        initialKws={kws ?? []}
      />
    </div>
  );
}
