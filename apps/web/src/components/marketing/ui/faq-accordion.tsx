'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from '@/components/marketing/layout/Container';

export interface FAQItem {
  q: string;
  a: string;
}

export function FAQAccordion({ items, className }: { items: FAQItem[]; className?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className={cn('w-full', className)}>
      <Container className="py-32">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-center mb-12">
            Biežāk uzdotie jautājumi
          </h2>

          <div className="flex flex-col gap-3">
            {items.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl transition-colors overflow-hidden',
                    isOpen ? 'bg-muted/50' : 'bg-muted/30 hover:bg-muted/50',
                  )}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none"
                  >
                    <span className="text-base font-bold text-foreground pr-8">{item.q}</span>
                    {isOpen ? (
                      <X className="w-5 h-5 text-foreground shrink-0" strokeWidth={2} />
                    ) : (
                      <Plus className="w-5 h-5 text-foreground shrink-0" strokeWidth={2} />
                    )}
                  </button>
                  <div
                    className={cn(
                      'grid transition-all duration-300 ease-out',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-base font-light text-foreground/80 leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
