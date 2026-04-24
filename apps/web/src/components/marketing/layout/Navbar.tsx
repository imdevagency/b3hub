'use client';

import Link from 'next/link';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from './Container';

const navItems = [
  { label: 'Funkcijas', href: '/features' },
  { label: 'Būvniekiem', href: '/buvniekiem' },
  { label: 'Pārvadātājiem', href: '/parvadatajiem' },
  { label: 'Karjeriem', href: '/karjeriem' },
  { label: 'Cenas', href: '/pricing' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/50">
      <Container>
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-12">
            {/* Logo */}
            <Link href="/" className="flex items-center" aria-label="B3Hub sākumlapa">
              <span className="text-2xl font-medium tracking-tighter text-foreground">B3Hub</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href={`/login`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Ienākt
            </Link>
            <CTAButton href={`/order`} variant="secondary" size="sm">
              Pasūtīt
            </CTAButton>
            <CTAButton href={`/register`} variant="primary" size="sm">
              Reģistrēties
            </CTAButton>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden p-2 text-foreground -mr-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Atvērt izvēlni"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </Container>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 bg-background',
          mobileOpen ? 'max-h-[collapse] border-b border-border' : 'max-h-0',
        )}
        style={{ maxHeight: mobileOpen ? '400px' : '0' }}
      >
        <nav className="px-6 pb-8 pt-4 flex flex-col gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-2xl font-medium tracking-tight text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex flex-col gap-4 mt-4 pt-8 border-t border-border">
            <Link
              href={`/login`}
              className="text-xl font-medium text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Ienākt
            </Link>
            <CTAButton
              href={`/order`}
              variant="primary"
              size="lg"
              className="text-center w-full mt-2"
              onClick={() => setMobileOpen(false)}
            >
              Pasūtīt tagad
            </CTAButton>
            <CTAButton
              href={`/register`}
              variant="secondary"
              size="lg"
              className="text-center w-full"
              onClick={() => setMobileOpen(false)}
            >
              Reģistrēt uzņēmumu
            </CTAButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
