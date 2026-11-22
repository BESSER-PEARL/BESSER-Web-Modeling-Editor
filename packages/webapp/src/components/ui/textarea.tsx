import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputBaseClass } from './input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => {
  return <textarea className={cn(inputBaseClass, 'min-h-[80px]', className)} ref={ref} {...props} />;
});
Textarea.displayName = 'Textarea';

export { Textarea };
