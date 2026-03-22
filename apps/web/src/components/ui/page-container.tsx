import React from 'react';
import { PageHeader, type PageHeaderProps } from './page-header';

interface PageContainerProps extends PageHeaderProps {
  children: React.ReactNode;
  containerClassName?: string;
  childrenClassName?: string;
}

export function PageContainer({
  title,
  description,
  action,
  className,
  containerClassName = '',
  childrenClassName = 'space-y-6',
  children,
}: PageContainerProps) {
  return (
    <div className={`space-y-8 w-full ${containerClassName}`}>
      <PageHeader
        title={title}
        description={description}
        action={action}
        className={className}
      />
      <div className={`w-full ${childrenClassName}`}>
        {children}
      </div>
    </div>
  );
}
