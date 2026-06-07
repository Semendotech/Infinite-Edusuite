import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type StudentPortalShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function StudentPortalShell({ title, description, children }: StudentPortalShellProps) {
  return (
    <div className="p-6 space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}