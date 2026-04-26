import { ReactNode } from 'react';
import { Container } from '@/components/marketing/layout/Container';

interface HeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pricingNote?: ReactNode;
  children?: ReactNode; // Right side mockup/visual content
  align?: 'left' | 'center';
  className?: string;
  wrapperClassName?: string; // full-bleed section background
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  actions,
  pricingNote,
  children,
  align = 'left',
  className,
  wrapperClassName,
}: HeroProps) {
  const hasRightSide = Boolean(children);

  const inner = (
    <Container
      as="section"
      className={`pt-40 pb-32 md:pt-48 md:pb-40${className ? ` ${className}` : ''}`}
    >
      <div
        className={
          hasRightSide
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12 items-center'
            : `flex flex-col gap-10 ${
                align === 'center'
                  ? 'items-center text-center max-w-4xl mx-auto'
                  : 'max-w-2xl text-left'
              }`
        }
      >
        <div className={`flex flex-col gap-8 md:gap-10 ${hasRightSide ? '' : 'w-full'}`}>
          {eyebrow && (
            <div
              className={`flex items-center gap-4 ${align === 'center' && !hasRightSide ? 'justify-center w-full' : ''}`}
            >
              <div className="h-0.5 w-12 bg-foreground" />
              <span className="text-sm font-bold tracking-widest uppercase text-foreground">
                {eyebrow}
              </span>
            </div>
          )}

          <h1 className="text-6xl md:text-7xl lg:text-[5rem] font-bold tracking-tighter text-foreground leading-[0.95]">
            {title}
          </h1>

          {subtitle && (
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-lg tracking-tight leading-snug">
              {subtitle}
            </p>
          )}

          {(actions || pricingNote) && (
            <div
              className={`flex flex-col mt-2 gap-4 ${align === 'center' && !hasRightSide ? 'items-center justify-center' : ''}`}
            >
              {actions && (
                <div
                  className={`flex flex-col sm:flex-row gap-4 ${align === 'center' && !hasRightSide ? 'justify-center' : 'items-start'}`}
                >
                  {actions}
                </div>
              )}
              {pricingNote && (
                <p className="text-sm text-muted-foreground font-light">{pricingNote}</p>
              )}
            </div>
          )}
        </div>

        {hasRightSide && <div className="w-full">{children}</div>}
      </div>
    </Container>
  );

  if (wrapperClassName) {
    return <div className={`w-full ${wrapperClassName}`}>{inner}</div>;
  }

  return inner;
}
