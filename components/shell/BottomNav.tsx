"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const items: NavItem[] = [
  {
    href: "/",
    label: "Início",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <path
          d="M4 11.5 12 4l8 7.5M6 9.5V20h12V9.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/contas-fixas",
    label: "Fixas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <path
          d="M5 12a7 7 0 0 1 12-4.9L19 9M19 12a7 7 0 0 1-12 4.9L5 15M19 5v4h-4M5 19v-4h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/explorar",
    label: "Explorar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m14.5 9.5-1.8 4.7a.6.6 0 0 1-.35.35L7.5 16.5l1.8-4.7a.6.6 0 0 1 .35-.35Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5 20c1.2-3.5 4-5.5 7-5.5s5.8 2 7 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-[var(--background)]/95 backdrop-blur-sm dark:border-white/10 lg:top-[var(--header-height)] lg:bottom-auto lg:h-[calc(100dvh-var(--header-height))] lg:w-20 lg:border-t-0 lg:border-r"
    >
      <ul className="flex h-[var(--bottom-nav-height)] items-stretch justify-around lg:h-auto lg:flex-col lg:justify-start lg:gap-2 lg:py-4">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex flex-1 lg:flex-none">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand)] lg:flex-none lg:py-2 ${
                  isActive
                    ? "text-[var(--color-brand)]"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
