import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gray-900 active:bg-gray-800',
        destructive: 'bg-red-500 active:bg-red-600',
        outline: 'border border-gray-300 bg-transparent active:bg-gray-100',
        secondary: 'bg-gray-100 active:bg-gray-200',
        ghost: 'active:bg-gray-100',
        link: 'underline-offset-4 active:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// Maps variant → spinner/text color for non-Tailwind rendering contexts
const VARIANT_TEXT_COLOR: Record<string, string> = {
  default: colors.white,
  destructive: colors.white,
  outline: colors.primary,
  secondary: colors.primary,
  ghost: colors.primary,
  link: colors.primary,
};

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof Pressable>, VariantProps<typeof buttonVariants> {
  className?: string;
  /** Show a spinner and block interaction while true */
  isLoading?: boolean;
  /** Override the label/spinner color (defaults per variant) */
  textColor?: string;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    { className, variant, size, isLoading = false, textColor, disabled, children, ...props },
    ref,
  ) => {
    const resolvedTextColor = textColor ?? VARIANT_TEXT_COLOR[variant ?? 'default'] ?? colors.white;

    return (
      <Pressable
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Loading overlay — spinner replaces content, preserves dimensions */}
        {isLoading ? (
          <ActivityIndicator size="small" color={resolvedTextColor} />
        ) : typeof children === 'string' ? (
          // Convenience: auto-wrap string children in Text so callers don't have to
          <Text style={[btnStyles.label, { color: resolvedTextColor }]}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = 'Button';

const btnStyles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export { Button, buttonVariants };
