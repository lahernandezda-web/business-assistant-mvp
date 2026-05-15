import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <main className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          CURSOR / AI Building System
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Monolito modular para chatbots y automatizaciones. Esta es la app web
          mínima: chat en stub y endpoints listos para conectar Supabase y
          Claude en fases posteriores.
        </p>
        <nav className="mt-8 flex flex-col items-center gap-3 text-sm sm:flex-row sm:justify-center">
          <Link
            href="/chat"
            className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Ir al chat
          </Link>
          <a
            href="/api/health"
            className="text-zinc-700 underline underline-offset-2 dark:text-zinc-300"
          >
            GET /api/health
          </a>
        </nav>
      </main>
    </div>
  );
}
