import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-orange-50 to-transparent"
      />
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 animate-in">{children}</main>
    </div>
  );
}
