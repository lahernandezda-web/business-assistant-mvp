import Link from "next/link";

const MODULE_LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/business-profile", label: "Perfil del negocio" },
  { href: "/contacts", label: "Contactos" },
  { href: "/follow-up-tasks", label: "Tareas de seguimiento" },
] as const;

export function ModuleNav() {
  return (
    <nav
      aria-label="Módulos del producto"
      className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <ul className="flex flex-wrap gap-1.5">
        {MODULE_LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-zinc-50"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
