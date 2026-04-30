'use client';

/**
 * PageHelp
 *
 * A help button (?) that opens a side Sheet with structured tutorial content.
 * Add this to the PageHeader `action` slot on each page to give newcomers
 * a full walkthrough of what the page does and how to use it.
 *
 * @example
 * <PageHeader
 *   title="Rentabilitāte"
 *   action={
 *     <div className="flex items-center gap-2">
 *       <Button ...>...</Button>
 *       <PageHelp title="Kā lasīt rentabilitāti" sections={[...]} />
 *     </div>
 *   }
 * />
 */

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface HelpSection {
  /** Section heading */
  heading: string;
  /** Main body paragraph */
  body?: string;
  /** Optional numbered steps */
  steps?: string[];
  /** Optional highlighted tip/note */
  tip?: string;
}

interface PageHelpProps {
  /** Sheet title */
  title: string;
  /** Structured sections */
  sections: HelpSection[];
}

export function PageHelp({ title, sections }: PageHelpProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Palīdzība / ceļvedis">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-80 overflow-y-auto sm:max-w-sm" side="right">
        <SheetHeader className="px-6 pb-2 pt-6">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 pb-10">
          {sections.map((section, i) => (
            <div key={i} className="space-y-2">
              {/* Heading */}
              <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>

              {/* Body paragraph */}
              {section.body && (
                <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
              )}

              {/* Numbered steps */}
              {section.steps && section.steps.length > 0 && (
                <ol className="ml-0.5 space-y-2">
                  {section.steps.map((step, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {j + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {/* Highlighted tip */}
              {section.tip && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-medium text-amber-800">💡 {section.tip}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
