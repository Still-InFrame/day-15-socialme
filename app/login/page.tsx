import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { EmailAuthForm } from "@/components/EmailAuthForm";

type SearchParams = Promise<{ error?: string }>;

const FEATURES = [
  "AI finds the topics your customers ask about",
  "Live questions from Hacker News & Lemmy",
  "One-click, on-brand reply drafts",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-orange-300/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-200/50 blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg shadow-orange-600/20">
            s
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900">socialme</h1>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-zinc-600">
            Find the people already asking questions your business can answer — and be the one who
            replies first.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-xl shadow-zinc-900/5 backdrop-blur">
          <h2 className="text-lg font-semibold text-zinc-900">Sign in</h2>
          <p className="mt-1 text-sm text-zinc-500">Continue with Google to get started.</p>

          <div className="mt-6">
            <GoogleSignInButton />
          </div>

          {error === "oauth_failed" && (
            <p className="mt-4 text-center text-sm text-red-500">
              Sign-in failed. Please try again.
            </p>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">or</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <EmailAuthForm />

          <ul className="mt-7 space-y-2.5 border-t border-zinc-100 pt-6">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600">
                <svg
                  className="mt-0.5 h-4 w-4 flex-none text-orange-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Day 15 · 100 Day AI Build Challenge
        </p>
      </div>
    </div>
  );
}
