import React from 'react';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '../../../shared/constants/z-index';

/* -------------------------------------------------------------------------- */
/*  Prop interfaces (kept identical so consuming code never breaks)           */
/* -------------------------------------------------------------------------- */

interface SaveStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  $status: 'saved' | 'saving' | 'error';
}

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  $variant?: 'primary' | 'secondary' | 'success' | 'info';
}

interface UndoRedoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  $disabled?: boolean;
}

interface DragGhostProps extends React.HTMLAttributes<HTMLDivElement> {
  $x: number;
  $y: number;
  $offsetX: number;
  $offsetY: number;
}

interface DropdownButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  $isOpen?: boolean;
}

interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  $isOpen: boolean;
}

interface DropdownOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  $isOpen: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Helper: map variant / status values to colours                            */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  saved: '#27ae60',
  saving: '#3498db',
  error: '#e74c3c',
};

const VARIANT_COLORS: Record<string, string> = {
  primary: '#28a745',
  secondary: '#ffc107',
  success: '#4CAF50',
  info: '#2196F3',
};

const DEFAULT_VARIANT_COLOR = '#6c757d';

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

export const EditorContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn(
      'flex flex-col h-full w-full font-sans',
      'bg-[var(--quantum-editor-bg,#ffffff)]',
      'text-[var(--quantum-editor-text,#0f172a)]',
      className,
    ),
    ...props,
  }),
);
EditorContainer.displayName = 'EditorContainer';

export const Toolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn(
      'flex items-center gap-2.5 p-2.5',
      'bg-[var(--quantum-editor-surface,#f8fafc)]',
      'border-b border-[var(--quantum-editor-border,#d5dde8)]',
      className,
    ),
    ...props,
  }),
);
Toolbar.displayName = 'Toolbar';

export const Workspace = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn('flex flex-1 overflow-hidden', className),
    ...props,
  }),
);
Workspace.displayName = 'Workspace';

export const PaletteContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn(
      'w-[250px] overflow-y-auto p-2.5',
      'bg-[var(--quantum-editor-surface,#f8fafc)]',
      'border-r border-[var(--quantum-editor-border,#d5dde8)]',
      className,
    ),
    ...props,
  }),
);
PaletteContainer.displayName = 'PaletteContainer';

export const CircuitContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn(
      'flex-1 overflow-auto p-5 relative',
      'bg-[var(--quantum-editor-bg,#ffffff)]',
      className,
    ),
    ...props,
  }),
);
CircuitContainer.displayName = 'CircuitContainer';

export const SaveStatus = React.forwardRef<HTMLDivElement, SaveStatusProps>(
  ({ $status, className, style, ...props }, ref) =>
    React.createElement('div', {
      ref,
      className: cn(
        'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium',
        className,
      ),
      style: { color: STATUS_COLORS[$status], ...style },
      ...props,
    }),
);
SaveStatus.displayName = 'SaveStatus';

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ $variant, className, style, ...props }, ref) =>
    React.createElement('button', {
      ref,
      className: cn(
        'px-4 py-2 text-white border-none rounded cursor-pointer font-bold',
        'hover:opacity-90',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      ),
      style: {
        backgroundColor: $variant ? VARIANT_COLORS[$variant] ?? DEFAULT_VARIANT_COLOR : DEFAULT_VARIANT_COLOR,
        ...style,
      },
      ...props,
    }),
);
ToolbarButton.displayName = 'ToolbarButton';

export const UndoRedoButton = React.forwardRef<HTMLButtonElement, UndoRedoButtonProps>(
  ({ $disabled, className, style, ...props }, ref) =>
    React.createElement('button', {
      ref,
      className: cn(
        'px-2.5 py-[5px] rounded',
        'bg-[var(--quantum-editor-bg,#ffffff)]',
        'text-[var(--quantum-editor-text,#0f172a)]',
        'border border-[var(--quantum-editor-border,#d5dde8)]',
        className,
      ),
      style: {
        cursor: $disabled ? 'not-allowed' : 'pointer',
        opacity: $disabled ? 0.5 : 1,
        ...style,
      },
      ...props,
    }),
);
UndoRedoButton.displayName = 'UndoRedoButton';

export const DragGhost = React.forwardRef<HTMLDivElement, DragGhostProps>(
  ({ $x, $y, $offsetX, $offsetY, className, style, ...props }, ref) =>
    React.createElement('div', {
      ref,
      className: cn('fixed pointer-events-none', className),
      style: {
        zIndex: Z_INDEX.POPOVER,
        left: $x - $offsetX,
        top: $y - $offsetY,
        ...style,
      },
      ...props,
    }),
);
DragGhost.displayName = 'DragGhost';

export const DropdownContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn('relative inline-block', className),
    ...props,
  }),
);
DropdownContainer.displayName = 'DropdownContainer';

export const DropdownButton = React.forwardRef<HTMLButtonElement, DropdownButtonProps>(
  ({ $isOpen, className, children, ...props }, ref) =>
    React.createElement(
      'button',
      {
        ref,
        className: cn(
          'px-4 py-2 text-white border-none rounded cursor-pointer font-bold',
          'flex items-center gap-1.5 bg-[#9c27b0]',
          'hover:opacity-90',
          className,
        ),
        ...props,
      },
      children,
      React.createElement('span', {
        className: cn(
          'text-[10px] inline-block transition-transform duration-200',
          $isOpen ? 'rotate-180' : 'rotate-0',
        ),
        'aria-hidden': true,
      }, '\u25BC'),
    ),
);
DropdownButton.displayName = 'DropdownButton';

export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ $isOpen, className, ...props }, ref) =>
    React.createElement('div', {
      ref,
      className: cn(
        'absolute top-full left-0 min-w-[280px] max-h-[400px] overflow-y-auto rounded mt-1 z-10',
        'bg-[var(--quantum-editor-bg,#ffffff)]',
        'border border-[var(--quantum-editor-border,#d5dde8)]',
        'shadow-[var(--quantum-editor-tooltip-shadow,0_12px_28px_rgba(2,6,23,0.18))]',
        $isOpen ? 'block' : 'hidden',
        className,
      ),
      ...props,
    }),
);
DropdownMenu.displayName = 'DropdownMenu';

export const DropdownCategory = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) =>
  React.createElement('div', {
    ref,
    className: cn(
      'px-3 py-2 text-[11px] font-bold uppercase tracking-[0.5px]',
      'text-[var(--quantum-editor-muted-text,#64748b)]',
      'bg-[var(--quantum-editor-surface,#f8fafc)]',
      'border-b border-[var(--quantum-editor-border,#d5dde8)]',
      className,
    ),
    ...props,
  }),
);
DropdownCategory.displayName = 'DropdownCategory';

export const DropdownItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) =>
  React.createElement('button', {
    ref,
    className: cn(
      'w-full px-4 py-2.5 border-none bg-transparent text-left cursor-pointer',
      'flex flex-col gap-0.5',
      'border-b border-[var(--quantum-editor-border,#d5dde8)] last:border-b-0',
      'text-[var(--quantum-editor-text,#0f172a)]',
      'hover:bg-[var(--quantum-editor-hover,rgba(56,189,248,0.16))]',
      className,
    ),
    ...props,
  }),
);
DropdownItem.displayName = 'DropdownItem';

export const DropdownItemTitle = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) =>
  React.createElement('span', {
    ref,
    className: cn(
      'font-semibold text-sm',
      'text-[var(--quantum-editor-text,#0f172a)]',
      className,
    ),
    ...props,
  }),
);
DropdownItemTitle.displayName = 'DropdownItemTitle';

export const DropdownItemDescription = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) =>
  React.createElement('span', {
    ref,
    className: cn(
      'text-[11px]',
      'text-[var(--quantum-editor-muted-text,#64748b)]',
      className,
    ),
    ...props,
  }),
);
DropdownItemDescription.displayName = 'DropdownItemDescription';

export const DropdownOverlay = React.forwardRef<HTMLDivElement, DropdownOverlayProps>(
  ({ $isOpen, className, ...props }, ref) =>
    React.createElement('div', {
      ref,
      className: cn(
        'fixed inset-0 z-[9]',
        $isOpen ? 'block' : 'hidden',
        className,
      ),
      ...props,
    }),
);
DropdownOverlay.displayName = 'DropdownOverlay';
