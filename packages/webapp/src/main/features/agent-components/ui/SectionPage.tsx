import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Page layout of one components section: title, description, "Add" button and the item list. */
export function SectionPage({ title, description, onAdd, addLabel, children }: {
  title: string; description: string; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Button type="button" size="sm" onClick={onAdd} className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function EmptyHint({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}

export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
