import { cn } from '@/lib/utils';

type ContainerProps = React.ComponentPropsWithoutRef<'div'> & {
  as?: React.ElementType;
};

export function Container({ children, className, as: Tag = 'div', ...props }: ContainerProps) {
  return (
    <Tag className={cn('mx-auto w-full max-w-350 px-6 lg:px-12', className)} {...props}>
      {children}
    </Tag>
  );
}
