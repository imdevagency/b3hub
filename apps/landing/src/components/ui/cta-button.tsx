import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';

const ctaButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 text-lg font-medium transition-colors text-center px-10 py-5 select-none',
  {
    variants: {
      variant: {
        /** Black fill — primary action on light background */
        primary: 'bg-foreground text-background hover:bg-foreground/90',
        /** Muted fill — secondary action on light background */
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        /** Border only — tertiary action on light background */
        outline: 'border border-border text-foreground hover:border-foreground',
        /** White fill — primary action on dark/inverted background */
        inverted: 'bg-background text-foreground hover:bg-background/90',
      },
      size: {
        sm: 'px-5 py-2.5 text-sm',
        default: 'px-10 py-5 text-lg',
        lg: 'px-12 py-6 text-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

interface CTAButtonProps extends VariantProps<typeof ctaButtonVariants> {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function CTAButton({ href, children, variant, size, className, onClick }: CTAButtonProps) {
  return (
    <Link
      href={href}
      className={cn(ctaButtonVariants({ variant, size }), className)}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
