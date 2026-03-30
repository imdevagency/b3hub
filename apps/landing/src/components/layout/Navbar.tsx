'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Building2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Produkts', href: '/#features' },
  { label: 'Materiāli', href: '/#materials' },
  { label: 'B3 Laukumi', href: '/#b3-fields' },
  { label: 'Pakalpojumi', href: '/#construction-services' },
  { label: 'Cenas', href: '/pricing' },
  { label: 'Blogs', href: '/blog' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="B3Hub sākumlapa">
            <Building2 className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-gray-900">B3Hub</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex md:items-center md:gap-1" aria-label="Galvenā navigācija">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/login`}
              className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
            >
              Ieiet
            </Link>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/register`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Sākt bez maksas
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden rounded-md p-2 text-gray-700 hover:bg-gray-100"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Atvērt izvēlni"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-200',
          mobileOpen ? 'max-h-96' : 'max-h-0',
        )}
      >
        <nav className="border-t border-gray-200 bg-white px-6 pb-4 pt-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/login`}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Ieiet
            </Link>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/register`}
              className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => setMobileOpen(false)}
            >
              Sākt bez maksas
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
