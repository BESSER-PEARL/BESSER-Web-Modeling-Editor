import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { Arrow, PopoverBody, PopoverContainer } from './popover-styles';

export type Props = {
  children?: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  alignment?: 'start' | 'center' | 'end';
  position: { x: number; y: number };
  maxHeight?: number;
  style?: React.CSSProperties;
  onMouseDown?: (event: React.MouseEvent) => void;
  onMouseMove?: (event: React.MouseEvent) => void;
} & HTMLAttributes<HTMLDivElement>;

export const Popover = forwardRef<HTMLDivElement, Props>(
  ({ children, placement = 'right', alignment = 'center', maxHeight, style, onMouseDown, onMouseMove, ...props }, ref) => (
    <PopoverContainer 
      ref={ref} 
      placement={placement} 
      alignment={alignment} 
      style={style} 
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      {...props}
    >
      <Arrow placement={placement} alignment={alignment} />
      <PopoverBody maxHeight={maxHeight}>{children}</PopoverBody>
    </PopoverContainer>
  ),
);
