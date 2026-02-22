"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/api-gateway", label: "Gateway" },
  { href: "/agents", label: "Agents" },
  { href: "/integrations", label: "Integrations" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_#67e8f9]" />
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">AgentPassport</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Control Plane</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-cyan-300 text-slate-950"
                    : "bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
