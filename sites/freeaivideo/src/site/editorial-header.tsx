import type { ReactNode } from 'react';

export function EditorialHeader({
  title,
  beforeTitle,
  children,
}: {
  title: string;
  beforeTitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="editorial-header">
      {beforeTitle}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
