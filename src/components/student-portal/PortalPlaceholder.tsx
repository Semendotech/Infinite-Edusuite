import type { ReactNode } from 'react';

type PortalPlaceholderProps = {
  children?: ReactNode;
};

export function PortalPlaceholder({ children }: PortalPlaceholderProps) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>{children ?? 'This module is ready in the navigation. Connect backend workflows to enable full functionality.'}</p>
    </div>
  );
}