import { Gate } from '../types';

export const TGate: Gate = {
    type: 'T',
    id: 't',
    label: 'T',
    symbol: 'Z^¼',
    description: 'T Gate (⁴√Z): Rotates 45° around Z-axis. Adds π/4 phase to |1⟩. Essential for universal quantum computing.',
    isControl: false
};

export const TDaggerGate: Gate = {
    type: 'T_DAG',
    id: 't-dag',
    label: 'T†',
    symbol: 'Z^-¼',
    description: 'T-Dagger Gate (inverse ⁴√Z): Rotates -45° around Z-axis. Removes π/4 phase. Undoes T gate.',
    isControl: false
};

export const SqrtSqrtXGate: Gate = {
    type: 'SQRT_SQRT_X',
    id: 'sqrt-sqrt-x',
    label: 'X^¼',
    symbol: 'X^¼',
    description: '⁴√X Gate: Rotates 45° around X-axis. Four applications = one X (NOT) gate.',
    isControl: false
};

export const SqrtSqrtXDaggerGate: Gate = {
    type: 'SQRT_SQRT_X_DAG',
    id: 'sqrt-sqrt-x-dag',
    label: 'X^-¼',
    symbol: 'X^-¼',
    description: '⁴√X-Dagger Gate: Rotates -45° around X-axis. Undoes X^¼ gate.',
    isControl: false
};

export const SqrtSqrtYGate: Gate = {
    type: 'SQRT_SQRT_Y',
    id: 'sqrt-sqrt-y',
    label: 'Y^¼',
    symbol: 'Y^¼',
    description: '⁴√Y Gate: Rotates 45° around Y-axis. Four applications = one Y gate.',
    isControl: false
};

export const SqrtSqrtYDaggerGate: Gate = {
    type: 'SQRT_SQRT_Y_DAG',
    id: 'sqrt-sqrt-y-dag',
    label: 'Y^-¼',
    symbol: 'Y^-¼',
    description: '⁴√Y-Dagger Gate: Rotates -45° around Y-axis. Undoes Y^¼ gate.',
    isControl: false
};
