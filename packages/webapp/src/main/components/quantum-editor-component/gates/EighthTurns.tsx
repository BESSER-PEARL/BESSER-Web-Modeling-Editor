import { Gate } from '../types';

export const TGate: Gate = {
    type: 'T',
    id: 't',
    label: 'T',
    symbol: 'Z^¼',
    description: 'Z^1/4 Gate',
    isControl: false
};

export const TDaggerGate: Gate = {
    type: 'T_DAG',
    id: 't-dag',
    label: 'T†',
    symbol: 'Z^-¼',
    description: 'Inverse Z^1/4 Gate',
    isControl: false
};

export const SqrtSqrtXGate: Gate = {
    type: 'SQRT_SQRT_X',
    id: 'sqrt-sqrt-x',
    label: 'X^¼',
    symbol: 'X^¼',
    description: 'X^1/4 Gate',
    isControl: false
};

export const SqrtSqrtXDaggerGate: Gate = {
    type: 'SQRT_SQRT_X_DAG',
    id: 'sqrt-sqrt-x-dag',
    label: 'X^-¼',
    symbol: 'X^-¼',
    description: 'Inverse X^1/4 Gate',
    isControl: false
};

export const SqrtSqrtYGate: Gate = {
    type: 'SQRT_SQRT_Y',
    id: 'sqrt-sqrt-y',
    label: 'Y^¼',
    symbol: 'Y^¼',
    description: 'Y^1/4 Gate',
    isControl: false
};

export const SqrtSqrtYDaggerGate: Gate = {
    type: 'SQRT_SQRT_Y_DAG',
    id: 'sqrt-sqrt-y-dag',
    label: 'Y^-¼',
    symbol: 'Y^-¼',
    description: 'Inverse Y^1/4 Gate',
    isControl: false
};
