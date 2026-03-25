import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApollonError } from '../../services/error-management/errorManagementSlice';

type Props = {
  error: ApollonError;
  onClose: (error: ApollonError) => void;
};

export function ErrorMessage(props: Props) {
  const { headerText, bodyText } = props.error;

  return (
    <Card className="w-full border-destructive/30 bg-destructive/5 text-destructive shadow-lg">
      <div role="alert" className="flex items-start gap-3 p-3">
        <div className="mt-0.5 rounded-md bg-destructive/10 p-1 text-destructive">
          <AlertTriangle className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{headerText}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-destructive/80">{bodyText}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => props.onClose(props.error)}
          aria-label="Dismiss error"
        >
          <X className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
