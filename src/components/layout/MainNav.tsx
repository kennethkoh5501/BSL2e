"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clock-in", label: "Clock In" },
  { href: "/bsl2e-log", label: "BSL2e Log" },
  { href: "/ppe-log", label: "PPE Log" },
  { href: "/admin", label: "Admin" }
];

export default function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-64 border-r border-slate-200 bg-white/80 px-4 py-6 md:block">
      <ul className="space-y-2">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white shadow"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
