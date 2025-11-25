import { Gate } from '../types';

export const SGate: Gate = {
    type: 'S',
    id: 's',
    label: 'S',
    symbol: 'Z^½',
    description: 'Sqrt Z Gate',
    isControl: false
};

export const SDaggerGate: Gate = {
    type: 'S_DAG',
    id: 's-dag',
    label: 'S†',
    symbol: 'Z^-½',
    description: 'Inverse Sqrt Z Gate',
    isControl: false
};

export const VGate: Gate = {
    type: 'V',
    id: 'v',
    label: 'V',
    symbol: 'X^½',
    description: 'Sqrt X Gate',
    isControl: false
};

export const VDaggerGate: Gate = {
    type: 'V_DAG',
    id: 'v-dag',
    label: 'V†',
    symbol: 'X^-½',
    description: 'Inverse Sqrt X Gate',
    isControl: false
};

export const SqrtYGate: Gate = {
    type: 'SQRT_Y',
    id: 'sqrt-y',
    label: '√Y',
    symbol: 'Y^½',
    description: 'Sqrt Y Gate',
    isControl: false
};

export const SqrtYDaggerGate: Gate = {
    type: 'SQRT_Y_DAG',
    id: 'sqrt-y-dag',
    label: '√Y†',
    symbol: 'Y^-½',
    description: 'Inverse Sqrt Y Gate',
    isControl: false
};
