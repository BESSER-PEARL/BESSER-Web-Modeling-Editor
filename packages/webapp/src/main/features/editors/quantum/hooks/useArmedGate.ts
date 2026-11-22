import { useEffect, useState } from 'react';
import { GateType } from '../types';

/**
 * Click-to-place alternative to dragging: a palette gate is "armed" by clicking it,
 * then placed by clicking a circuit cell. Escape disarms.
 */
export function useArmedGate() {
    const [armedGate, setArmedGate] = useState<GateType | null>(null);

    useEffect(() => {
        if (!armedGate) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            // Capture phase + stopPropagation so an enclosing dialog does not also close.
            e.stopPropagation();
            setArmedGate(null);
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [armedGate]);

    return { armedGate, setArmedGate };
}
