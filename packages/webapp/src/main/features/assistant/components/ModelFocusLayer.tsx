/**
 * Over the canvas: the element last opened from "Your model", marked with the
 * GitHub collaboration's own marks in the brand colour, until the next click.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ElementMark, RelationshipMark, relationshipLine, useElementBoxes } from '../../../shared/components/model-marks/ModelMarks';
import { subscribeToElementFocus } from '../../../shared/utils/elementFocusSignal';

const BRAND = 'hsl(var(--brand))';

export const ModelFocusLayer: React.FC = () => {
  const [focused, setFocused] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => (focused ? [focused] : []), [focused]);
  const box = useElementBoxes(ids, layer)[focused ?? ''];

  useEffect(() => subscribeToElementFocus(setFocused), []);
  useEffect(() => {
    if (!focused) return undefined;
    const clear = () => setFocused(null);
    document.addEventListener('pointerdown', clear, true);
    return () => document.removeEventListener('pointerdown', clear, true);
  }, [focused]);

  const points = focused && box ? relationshipLine(focused, box) : null;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {box && (points ? (
        <RelationshipMark testId="focused-relationship" color={BRAND} label={null} points={points} />
      ) : (
        <ElementMark testId="focused-element" color={BRAND} box={box} className="animate-in fade-in-0 duration-300" />
      ))}
    </div>
  );
};
