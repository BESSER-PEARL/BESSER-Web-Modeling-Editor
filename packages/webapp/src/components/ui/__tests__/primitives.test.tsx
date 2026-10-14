import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from '../alert';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { ConfirmDialog } from '../confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Input, inputBaseClass } from '../input';

describe('Alert', () => {
  it.each([
    ['default', 'status'],
    ['info', 'status'],
    ['warning', 'status'],
    ['success', 'status'],
    ['destructive', 'alert'],
  ] as const)('%s variant has role=%s', (variant, role) => {
    render(
      <Alert variant={variant}>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Body</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole(role)).toHaveTextContent('Heads up');
  });
});

describe('Button', () => {
  it('default and brand variants use the brand colour', () => {
    render(
      <>
        <Button>Default</Button>
        <Button variant="brand">Brand</Button>
      </>,
    );
    for (const name of ['Default', 'Brand']) {
      const cls = screen.getByRole('button', { name }).className;
      expect(cls).toContain('bg-brand');
      expect(cls).not.toContain('bg-primary');
    }
  });
});

describe('Checkbox', () => {
  it('puts className on the wrapper and keeps onCheckedChange', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Include" className="size-5" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Include' });
    expect(box.parentElement).toHaveClass('size-5');
    expect(box).not.toHaveClass('size-5');
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('Input', () => {
  it('styles aria-invalid from the shared base', () => {
    expect(inputBaseClass).toContain('aria-[invalid=true]:border-destructive');
    render(<Input aria-label="Name" />);
    expect(screen.getByLabelText('Name').className).toContain('placeholder:text-muted-foreground ');
  });
});

describe('Dialog', () => {
  it('caps height by default but a caller max-h / overflow wins', () => {
    render(
      <Dialog open>
        <DialogContent className="max-h-[86vh] overflow-hidden">
          <DialogTitle>Export</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('max-h-[86vh]');
    expect(cls).not.toContain('max-h-[calc(100dvh-2rem)]');
    expect(cls).toContain('overflow-hidden');
    expect(cls).not.toContain('overflow-y-auto');
  });

  it('ConfirmDialog footer uses gap, not space-x', () => {
    render(<ConfirmDialog open title="Delete?" description="Gone for good." onConfirm={() => {}} onCancel={() => {}} />);
    const footer = screen.getByRole('button', { name: 'Confirm' }).parentElement!;
    expect(footer).toHaveClass('gap-2');
    expect(footer.className).not.toMatch(/space-x/);
  });
});
