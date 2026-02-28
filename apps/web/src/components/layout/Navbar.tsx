'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Building2 } from 'lucide-react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const features = [
  {
    title: 'Materials Catalog',
    href: '#features',
    description: 'Browse and manage construction materials from verified suppliers.',
  },
  {
    title: 'Order Management',
    href: '#features',
    description: 'Create, track, and manage all your material orders in one place.',
  },
  {
    title: 'Container Tracking',
    href: '#features',
    description: 'Real-time tracking of containers and deliveries.',
  },
  {
    title: 'Recycling & Waste',
    href: '#features',
    description: 'Sustainable solutions for construction waste management.',
  },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-red-600" />
            <span className="text-xl font-bold text-gray-900">B3Hub</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-sm font-medium text-gray-700 hover:text-red-600">
                    Product
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-100 gap-3 p-4 md:w-125 md:grid-cols-2">
                      {features.map((feature) => (
                        <ListItem key={feature.title} title={feature.title} href={feature.href}>
                          {feature.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="#features" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'text-sm font-medium text-gray-700 hover:text-red-600',
                      )}
                    >
                      Features
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="#stats" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'text-sm font-medium text-gray-700 hover:text-red-600',
                      )}
                    >
                      Pricing
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="/order" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'text-sm font-semibold text-red-600 hover:text-red-700',
                      )}
                    >
                      Order a Skip
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <Button asChild variant="ghost" className="text-gray-700 hover:text-red-600">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-red-600 text-white hover:bg-red-500">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-700 rounded-md"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 py-4">
            <nav className="flex flex-col gap-2">
              <Link
                href="#features"
                className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-red-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#stats"
                className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-red-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/order"
                className="px-3 py-2 text-sm font-semibold text-red-600 rounded-md hover:bg-red-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Order a Skip →
              </Link>
            </nav>
            <div className="mt-4 flex flex-col gap-2 px-3">
              <Button asChild variant="outline" className="w-full justify-center">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                className="w-full justify-center bg-red-600 text-white hover:bg-red-500"
              >
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

const ListItem = ({
  className,
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'a'> & { href: string }) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className,
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none text-gray-900">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-gray-500">{children}</p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
};
