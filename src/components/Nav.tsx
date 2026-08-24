import Link from "next/link";
import { logoutAction } from "@/app/logout/actions";
import { LogoMark, MenuIcon } from "@/components/icons";
import { prisma } from "@/lib/prisma";

export async function Nav({
  name,
  title,
  isAdmin,
  active,
}: {
  name: string;
  title?: string | null;
  isAdmin: boolean;
  active: "dashboard" | "admin" | "reports" | "requests" | "devices" | "calendar";
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [pendingCount, pendingDeviceCount] = isAdmin
    ? await Promise.all([
        prisma.correctionRequest.count({ where: { status: "PENDING" } }),
        prisma.deviceRequest.count({ where: { status: "PENDING" } }),
      ])
    : [0, 0];

  // The admin account isn't an employee, so it never sees a personal hours
  // page, only teachers do. Nobody sees both.
  const links: { href: string; label: string; key: typeof active; badge?: number }[] = isAdmin
    ? [
        { href: "/admin", label: "Admin", key: "admin" as const },
        { href: "/admin/reports", label: "Reports", key: "reports" as const },
        { href: "/admin/requests", label: "Requests", key: "requests" as const, badge: pendingCount },
        { href: "/admin/devices", label: "Devices", key: "devices" as const, badge: pendingDeviceCount },
        { href: "/admin/calendar", label: "Calendar", key: "calendar" as const },
      ]
    : [{ href: "/dashboard", label: "My Hours", key: "dashboard" as const }];

  return (
    <header className="sticky top-0 z-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-4">
        <div className="glass-card rounded-2xl px-4 py-3">
          <input type="checkbox" id="nav-toggle" className="peer hidden" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl btn-teal-gradient text-white">
                <LogoMark className="h-4 w-4" />
              </span>
              <span className="font-extrabold text-sm sm:text-base text-ink truncate">
                Orlando Jewish Day School
              </span>
            </div>

            <nav className="hidden sm:flex items-center gap-1.5 shrink-0">
              {links.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`relative rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    active === link.key ? "bg-teal-900 text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {link.label}
                  {!!link.badge && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-orange-600 text-white text-[10px] font-extrabold grid place-items-center">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-ink/10">
                <span className="h-7 w-7 rounded-full bg-orange-500 text-white text-[10px] font-extrabold grid place-items-center">
                  {initials}
                </span>
                <span className="text-xs font-bold text-ink-soft max-w-[7rem] truncate">{name}</span>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer"
                >
                  Sign out
                </button>
              </form>
            </nav>

            <label
              htmlFor="nav-toggle"
              className="sm:hidden relative -m-2 p-2 rounded-lg text-ink-soft cursor-pointer shrink-0"
              aria-label="Menu"
            >
              <MenuIcon className="h-5 w-5" />
              {pendingCount + pendingDeviceCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-orange-600" />
              )}
            </label>
          </div>

          <nav className="sm:hidden hidden peer-checked:flex flex-col gap-1 mt-3 pt-3 border-t border-ink/10">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={`relative rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  active === link.key ? "bg-teal-900 text-white" : "text-ink-soft"
                }`}
              >
                {link.label}
                {!!link.badge && (
                  <span className="ml-2 inline-flex h-5 min-w-5 px-1.5 rounded-full bg-orange-600 text-white text-[11px] font-extrabold items-center justify-center">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
            <div className="flex items-center gap-2 px-3 py-2.5 mt-1 border-t border-ink/10">
              <span className="h-7 w-7 rounded-full bg-orange-500 text-white text-[10px] font-extrabold grid place-items-center">
                {initials}
              </span>
              <span className="text-sm font-bold text-ink-soft truncate">{name}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold text-ink-soft cursor-pointer"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </div>
    </header>
  );
}
