'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shadcn/utils';

const LINKS = [
  { href: '/', label: 'Voice Agent' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <span className="bg-gradient-to-r from-[#f5a623] to-[#ffd700] bg-clip-text text-transparent">
            VoicePay
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          {LINKS.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname === link.href || pathname?.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-white/5 text-[#f5a623]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
