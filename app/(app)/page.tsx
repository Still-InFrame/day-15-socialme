import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Feed } from "@/components/Feed";
import type { Thread } from "@/lib/types";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("socialme_profiles")
    .select("business_name")
    .maybeSingle();

  // New tenant with no business profile yet -> onboarding.
  if (!profile?.business_name) redirect("/onboarding");

  // Keep only the last 5 days: purge older rows, then load what remains.
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("socialme_threads").delete().lt("created_utc", cutoff);

  const [{ data: threads }, { data: kws }] = await Promise.all([
    supabase
      .from("socialme_threads")
      .select("*")
      .gte("created_utc", cutoff)
      .order("created_utc", { ascending: false }),
    supabase.from("socialme_keywords").select("term").order("term"),
  ]);

  return (
    <Feed
      initialThreads={(threads ?? []) as Thread[]}
      topics={(kws ?? []).map((k) => k.term)}
      businessName={profile.business_name}
    />
  );
}
