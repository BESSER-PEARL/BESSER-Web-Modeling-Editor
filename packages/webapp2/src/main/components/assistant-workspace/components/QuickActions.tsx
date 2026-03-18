import React from 'react';
import { Code, Layout, ArrowRight, Zap, Download, LayoutTemplate, RefreshCw, Layers, FilePlus, Wand2 } from 'lucide-react';

interface QuickAction {
  label: string;
  prompt: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  onAction: (prompt: string) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'generate': <Code className="h-3 w-3" />,
  'create': <Layout className="h-3 w-3" />,
  'gui': <LayoutTemplate className="h-3 w-3" />,
  'export': <Download className="h-3 w-3" />,
  'Replace': <RefreshCw className="h-3 w-3" />,
  'keep': <Layers className="h-3 w-3" />,
  'new tab': <FilePlus className="h-3 w-3" />,
  'Auto': <Zap className="h-3 w-3" />,
  'Llm': <Wand2 className="h-3 w-3" />,
};

function getIcon(label: string): React.ReactNode {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return <Zap className="h-3 w-3" />;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, onAction }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onAction(action.prompt)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-foreground active:scale-[0.97]"
        >
          {getIcon(action.label)}
          {action.label}
          <ArrowRight className="h-3 w-3 opacity-40" />
        </button>
      ))}
    </div>
  );
};
