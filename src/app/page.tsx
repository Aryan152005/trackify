import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-192.png" alt="Trackify" width={32} height={32} className="rounded-lg" />
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Trackify</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 sm:px-4 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 sm:px-4"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero — on mobile the content is often taller than the viewport,
          so we use `justify-start` with top padding and let the page scroll
          naturally. At `sm+` we center vertically since there's room. */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-start px-6 py-8 text-center sm:justify-center sm:py-12">
        <div className="mb-6 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700 sm:text-sm dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
          Your team&apos;s productivity, supercharged
        </div>

        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-5xl md:text-6xl dark:text-zinc-50">
          Daily work,{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            legible.
          </span>
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:mt-6 sm:text-lg dark:text-zinc-400">
          Trackify is a productivity workspace that treats tasks, notes, drawings,
          and your daily ritual as one thing. Personal or team — with real-time collab,
          a private lane inside every shared workspace, and nothing that feels like
          it was bolted on.
        </p>

        <div className="mt-6 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-xl"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-zinc-300 bg-white px-8 py-3.5 text-base font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Sign in
          </Link>
        </div>

        {/* Differentiator grid — leads with what Trackify actually does
            BETTER than the generic productivity apps, not a category
            list of everyone-ships-these features. */}
        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              emoji: "🎨",
              title: "Realtime drawings + mindmaps",
              desc: "Excalidraw + Yjs CRDT. Peers see strokes land as they happen, durable across tab close.",
            },
            {
              emoji: "🔒",
              title: "Private lane inside shared workspaces",
              desc: "Flip is_private on any task, note, board. Teammates can't see it even though you're in the same workspace.",
            },
            {
              emoji: "🔗",
              title: "Per-email share grants + delegation",
              desc: "Invite non-members to a specific note with view or editor access. They can forward onwards. All audited.",
            },
            {
              emoji: "📍",
              title: "Daily + weekly rituals, not a dumping list",
              desc: "Plan today (pick 3–5), Friday review, auto-computed shipped/slipped. Turns the tool into a practice.",
            },
            {
              emoji: "🧠",
              title: "Smart mindmap auto-built from your data",
              desc: "TF-IDF + graph layout over tasks, notes, entries, challenges. Re-renders as your work grows.",
            },
            {
              emoji: "⌨️",
              title: "Keyboard-first power mode",
              desc: "⌘K for everything, G-chord navigation, token-highlighting capture. Learn the grammar by typing.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="mb-1 text-2xl">{f.emoji}</div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {f.title}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-zinc-400">
        Built with care. Powered by Next.js, Supabase & Vercel.
      </footer>
    </div>
  );
}
