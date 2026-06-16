import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm shadow-orange-600/20">
            s
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">socialme</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Feed
          </Link>
          <Link
            href="/settings"
            className="rounded-lg px-3 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Settings
          </Link>
          <div className="mx-2 h-5 w-px bg-zinc-200" />
          <div className="group relative flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
              title={email}
            >
              {initial}
            </span>
            <SignOutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
